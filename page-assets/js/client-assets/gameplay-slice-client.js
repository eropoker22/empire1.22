var EmpireGameplaySliceClient = function(exports) {
  "use strict";
  const activeGameplaySlicePages = /* @__PURE__ */ new Set();
  const createMountedGameplaySlicePageExternalPort = (options) => {
    const applyExternalState = async (action, reason) => {
      const state = await action();
      if (!state) return null;
      options.applyState(state, reason);
      return state;
    };
    return {
      closeDistrictSheetFromExternal: options.closeDistrictSheet,
      getCurrentReadModel: options.getCurrentReadModel,
      getCurrentRenderState: options.getCurrentRenderState,
      handleSurfaceActionFromExternal: (target) => {
        if (!options.allowExternalSurfaceActions && !options.root.contains(target)) {
          return Promise.resolve(null);
        }
        return applyExternalState(
          () => options.handleSurfaceAction(target),
          "external:surface-action"
        );
      },
      selectDistrictFromExternal: (districtId) => applyExternalState(
        () => options.selectDistrict(districtId),
        "external:select-district"
      ),
      submitCommandFromExternal: async (command) => {
        var _a;
        const state = await options.submitCommand(command);
        options.applyState(state, "external:command");
        return {
          accepted: ((_a = state.lastCommandStatus) == null ? void 0 : _a.commandId) === command.id && state.lastCommandStatus.accepted === true,
          errors: state.errors,
          readModel: options.getCurrentReadModel(),
          renderState: state,
          transportFailure: state.errors.some((error) => error.code === "client.transport_error")
        };
      },
      destroy: options.destroy
    };
  };
  const registerMountedGameplaySlicePage = (mountedPage) => {
    activeGameplaySlicePages.add(mountedPage);
    return () => activeGameplaySlicePages.delete(mountedPage);
  };
  const closeDistrictSheet = (reason = "external district popup close") => {
    let closed = false;
    for (const mountedPage of activeGameplaySlicePages) {
      closed = mountedPage.closeDistrictSheetFromExternal(reason) || closed;
    }
    return closed;
  };
  const getSoleMountedGameplaySlicePage = () => {
    if (activeGameplaySlicePages.size !== 1) return null;
    return activeGameplaySlicePages.values().next().value ?? null;
  };
  const getCurrentGameplaySliceReadModel = () => {
    var _a;
    return ((_a = getSoleMountedGameplaySlicePage()) == null ? void 0 : _a.getCurrentReadModel()) ?? null;
  };
  const getCurrentGameplaySliceRenderState = () => {
    var _a;
    return ((_a = getSoleMountedGameplaySlicePage()) == null ? void 0 : _a.getCurrentRenderState()) ?? null;
  };
  const handleGameplaySliceSurfaceAction = (target) => {
    const mountedPage = getSoleMountedGameplaySlicePage();
    return mountedPage ? mountedPage.handleSurfaceActionFromExternal(target) : Promise.resolve(null);
  };
  const selectGameplaySliceDistrict = (districtId) => {
    const mountedPage = getSoleMountedGameplaySlicePage();
    return mountedPage ? mountedPage.selectDistrictFromExternal(districtId) : Promise.resolve(null);
  };
  const submitGameplaySliceCommand = (command) => {
    const mountedPage = getSoleMountedGameplaySlicePage();
    return mountedPage ? mountedPage.submitCommandFromExternal(command) : Promise.resolve(null);
  };
  const installGameplaySlicePageApi = (mountPage) => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    window.EmpireGameplaySliceClient = {
      closeDistrictSheet,
      getCurrentReadModel: getCurrentGameplaySliceReadModel,
      getCurrentRenderState: getCurrentGameplaySliceRenderState,
      handleSurfaceAction: handleGameplaySliceSurfaceAction,
      selectDistrict: selectGameplaySliceDistrict,
      submitCommand: submitGameplaySliceCommand,
      mount: mountPage,
      autoMount: () => Array.from(document.querySelectorAll("[data-gameplay-slice-client]")).map((root) => mountPage({ root })).filter((mount2) => mount2 !== null)
    };
  };
  const createDistrictBasicActionViewModels = (district, hasPendingCommand) => ({
    robTargets: (district.robTargets ?? []).map((target) => ({
      districtId: target.districtId,
      label: target.name,
      statusLabel: target.status,
      disabled: hasPendingCommand || !target.enabled,
      disabledReason: getDisabledReason(hasPendingCommand, target.disabledReason),
      cooldownLabel: (target.cooldownRemainingTicks ?? 0) > 0 ? `${target.cooldownRemainingTicks} ticks` : null
    })),
    heistTargets: (district.heistTargets ?? []).map((target) => ({
      districtId: target.districtId,
      label: target.name,
      ownerLabel: target.ownerPlayerId ? `Vlastník ${target.ownerPlayerId}` : "Neutrální distrikt",
      statusLabel: target.status,
      disabled: hasPendingCommand || !target.enabled,
      disabledReason: getDisabledReason(hasPendingCommand, target.disabledReason),
      cooldownLabel: (target.cooldownRemainingTicks ?? 0) > 0 ? `${target.cooldownRemainingTicks} ticks` : null
    })),
    placeDefense: district.placeDefense ? {
      actionLabel: "Vložit obranu",
      disabled: hasPendingCommand || !district.placeDefense.enabled,
      disabledReason: getDisabledReason(hasPendingCommand, district.placeDefense.disabledReason)
    } : null,
    removeDefense: district.removeDefense ? {
      actionLabel: "Odebrat obranu",
      disabled: hasPendingCommand || !district.removeDefense.enabled,
      disabledReason: getDisabledReason(hasPendingCommand, district.removeDefense.disabledReason)
    } : null
  });
  const getDisabledReason = (hasPendingCommand, disabledReason) => hasPendingCommand ? "Akce se zpracovává." : disabledReason;
  const toTitleCase$3 = (value) => value.split(/[-_]+/g).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
  const getStoragePercent = (storedAmount, storageCap) => Math.max(0, Math.min(100, Math.round(Math.max(0, storedAmount) / Math.max(1, storageCap) * 100)));
  const formatTickLabel = (tickCount) => `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;
  const createCooldownCountdown = (remainingTicks, tickRateMs, nowMs) => {
    const remainingMs = Math.max(0, Math.ceil(remainingTicks) * tickRateMs);
    return { remainingMs, endsAtMs: remainingMs > 0 ? nowMs + remainingMs : null };
  };
  const formatDurationMs = (durationMs) => {
    const totalSeconds = Math.max(0, Math.ceil(durationMs / 1e3));
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const totalMinutes = Math.ceil(totalSeconds / 60);
    if (totalMinutes < 60) {
      return `${totalMinutes}m`;
    }
    const hours = Math.round(totalMinutes / 60 * 10) / 10;
    return `${hours}h`;
  };
  const formatHeatLabel$1 = (value) => String(Math.round(Number.isFinite(value) ? value : 0));
  const formatResourceSummary = (values, emptyLabel) => {
    const parts = Object.entries(values).filter(([, amount]) => amount > 0);
    return parts.length > 0 ? parts.map(([resourceKey, amount]) => `${amount} ${formatResourceLabel$2(resourceKey)}`).join(" + ") : emptyLabel;
  };
  const RESOURCE_LABELS$2 = {
    "combat-module": "Bojový modul",
    combatModule: "Bojový modul"
  };
  const formatResourceLabel$2 = (resourceKey) => RESOURCE_LABELS$2[resourceKey] ?? toTitleCase$3(resourceKey);
  const formatSigned$1 = (value) => value >= 0 ? `+${value}` : String(value);
  const createDistrictPanelBuildingViewModels = (buildings, input) => buildings.map((building) => ({
    buildingId: building.buildingId,
    buildingTypeId: building.buildingTypeId,
    label: building.displayName || building.label,
    variantName: building.variantName,
    typeLabel: building.label,
    zoneLabel: toTitleCase$3(building.zone),
    roleLabel: building.role,
    info: building.info,
    statusLabel: `${building.status} · level ${building.level}`,
    summaryLabel: `${building.actions.filter((action) => action.enabled).length}/${building.actions.length} akcí připraveno`,
    stats: building.stats.map((stat) => ({
      label: stat.label,
      value: stat.value
    })),
    phaseAvailability: building.phaseAvailability ?? "neutral",
    phaseBadgeLabel: building.phaseBadgeLabel ?? null,
    phaseTooltip: building.phaseTooltip ?? null,
    passivePhaseBadgeLabel: building.passivePhaseBadgeLabel ?? null,
    passivePhaseEffectLabel: building.passivePhaseEffectLabel ?? null,
    passivePhaseTooltip: building.passivePhaseTooltip ?? null,
    specialActions: building.specialActions.map((action) => {
      const cooldown = createCooldownCountdown(action.cooldownRemainingTicks ?? 0, input.tickRateMs, input.nowMs);
      const effectiveInputCost = action.effectiveInputCost ?? action.baseInputCost ?? {};
      const effectiveOutputGain = action.effectiveOutputGain ?? action.baseOutputGain ?? {};
      const effectiveHeatGain = action.effectiveHeatGain ?? action.heatGain;
      const effectiveCooldownMs = action.effectiveCooldownMs ?? action.cooldownMs;
      const effectiveDurationMs = action.effectiveDurationMs ?? action.durationMs;
      return {
        actionId: action.actionId,
        label: action.label,
        description: action.description,
        effectSummary: action.effectSummary,
        durationLabel: effectiveDurationMs > 0 ? formatDurationMs(effectiveDurationMs) : "Okamžitě",
        cooldownLabel: cooldown.remainingMs > 0 ? `Čekání ${formatDurationMs(cooldown.remainingMs)}` : formatDurationMs(effectiveCooldownMs),
        cooldownRemainingMs: cooldown.remainingMs,
        cooldownEndsAtMs: cooldown.endsAtMs,
        heatLabel: `+${effectiveHeatGain}`,
        baseInputCost: { ...action.baseInputCost ?? action.effectiveInputCost ?? {} },
        effectiveInputCost: { ...effectiveInputCost },
        baseOutputGain: { ...action.baseOutputGain ?? action.effectiveOutputGain ?? {} },
        effectiveOutputGain: { ...effectiveOutputGain },
        baseHeatGain: action.baseHeatGain ?? action.heatGain,
        effectiveHeatGain,
        baseCooldownMs: action.baseCooldownMs ?? action.cooldownMs,
        effectiveCooldownMs,
        baseDurationMs: action.baseDurationMs ?? action.durationMs,
        effectiveDurationMs,
        inputSummary: formatResourceSummary(effectiveInputCost, "Zdarma"),
        outputSummary: formatResourceSummary(effectiveOutputGain, "Bez výstupu"),
        disabled: input.hasPendingCommand || !action.enabled,
        disabledReason: input.hasPendingCommand ? "Akce se zpracovává." : action.disabledReason,
        phaseAvailability: action.phaseAvailability ?? "neutral",
        phaseBadgeLabel: action.phaseBadgeLabel ?? null,
        phaseTooltip: action.phaseTooltip ?? null,
        blockedReason: action.blockedReason ?? action.phaseBlockedReason ?? null,
        preferredPhase: action.preferredPhase ?? null,
        currentPhase: action.currentPhase ?? null,
        phaseEffectSummary: action.phaseEffectSummary ?? [],
        phaseEffectLabel: createPhaseEffectLabel({
          phaseTooltip: action.phaseTooltip ?? null,
          phaseEffectSummary: action.phaseEffectSummary ?? []
        })
      };
    }),
    actions: building.actions.map((action) => {
      const cooldown = createCooldownCountdown(action.cooldownRemainingTicks ?? 0, input.tickRateMs, input.nowMs);
      const effectiveInputCost = action.effectiveInputCost ?? action.inputCost;
      const effectiveOutputGain = action.effectiveOutputGain ?? action.outputGain;
      const effectiveHeatGain = action.effectiveHeatGain ?? action.heatGain;
      const effectiveCooldownMs = action.effectiveCooldownMs ?? action.cooldownMs;
      const effectiveDurationMs = action.effectiveDurationMs ?? action.durationMs;
      return {
        actionId: action.actionId,
        label: action.label,
        description: action.description,
        statusLabel: toTitleCase$3(action.status),
        inputSummary: formatResourceSummary(effectiveInputCost, "Zdarma"),
        outputSummary: formatResourceSummary(effectiveOutputGain, "Bez výstupu"),
        baseInputCost: { ...action.baseInputCost ?? action.inputCost },
        effectiveInputCost: { ...effectiveInputCost },
        baseOutputGain: { ...action.baseOutputGain ?? action.outputGain },
        effectiveOutputGain: { ...effectiveOutputGain },
        baseHeatGain: action.baseHeatGain ?? action.heatGain,
        effectiveHeatGain,
        baseCooldownMs: action.baseCooldownMs ?? action.cooldownMs,
        effectiveCooldownMs,
        baseDurationMs: action.baseDurationMs ?? action.durationMs,
        effectiveDurationMs,
        expectedEffectSummary: action.expectedEffectSummary,
        riskSummary: action.riskSummary,
        inputs: action.requiresInput.map((requiredInput) => ({
          id: requiredInput.id,
          type: requiredInput.type,
          label: requiredInput.label,
          required: requiredInput.required,
          min: requiredInput.min,
          max: requiredInput.max,
          options: requiredInput.options ?? []
        })),
        cooldownLabel: cooldown.remainingMs > 0 ? `Čekání ${formatDurationMs(cooldown.remainingMs)}` : `${Math.ceil(effectiveCooldownMs / 1e3)}s čekání`,
        cooldownRemainingMs: cooldown.remainingMs,
        cooldownEndsAtMs: cooldown.endsAtMs,
        heatLabel: `+${effectiveHeatGain}`,
        influenceLabel: formatSigned$1(action.influenceChange),
        disabled: input.hasPendingCommand || !action.enabled,
        disabledReason: input.hasPendingCommand ? "Akce se zpracovává." : action.disabledReason,
        phaseAvailability: action.phaseAvailability ?? "neutral",
        phaseBadgeLabel: action.phaseBadgeLabel ?? null,
        phaseTooltip: action.phaseTooltip ?? null,
        blockedReason: action.blockedReason ?? action.phaseBlockedReason ?? null,
        preferredPhase: action.preferredPhase ?? null,
        currentPhase: action.currentPhase ?? null,
        phaseEffectSummary: action.phaseEffectSummary ?? [],
        phaseEffectLabel: createPhaseEffectLabel({
          phaseTooltip: action.phaseTooltip ?? null,
          phaseEffectSummary: action.phaseEffectSummary ?? []
        })
      };
    }),
    productionLines: createBuildingProductionLineViewModels(building, input.tickRateMs)
  }));
  const createBuildingProductionLineViewModels = (building, tickRateMs) => {
    var _a, _b, _c, _d;
    const lines = ((_a = building.pharmacy) == null ? void 0 : _a.lines) ?? ((_b = building.drugLab) == null ? void 0 : _b.lines) ?? ((_c = building.factory) == null ? void 0 : _c.productionLines) ?? ((_d = building.armory) == null ? void 0 : _d.productionLines) ?? [];
    return lines.map((line) => ({
      recipeId: line.recipeId,
      label: line.label,
      statusLabel: toTitleCase$3(line.status),
      inputSummary: createProductionLineCostLabel(line),
      durationLabel: line.remainingMs > 0 ? `Zbývá ${formatDurationMs(line.remainingMs)}` : formatDurationMs(Math.max(0, line.effectiveUnitDurationTicks * tickRateMs)),
      canStart: line.canStart,
      disabledReason: line.disabledReason
    }));
  };
  const createProductionLineCostLabel = (line) => {
    const costs = [
      Number(line.unitCleanCashCost || 0) > 0 ? `${Number(line.unitCleanCashCost)} čistých peněz` : "",
      formatResourceSummary(line.materialInputCosts ?? {}, "")
    ].filter(Boolean);
    return costs.length > 0 ? costs.join(" · ") : "Zdarma";
  };
  const createPhaseEffectLabel = (input) => {
    if (input.phaseEffectSummary.length > 0) {
      return input.phaseEffectSummary.join(", ");
    }
    const tooltip = String(input.phaseTooltip || "").trim();
    return tooltip || null;
  };
  const createDistrictPanelViewModel = (slice, uiState, options = {}) => {
    var _a, _b;
    if (!(slice == null ? void 0 : slice.district) || uiState.selectedDistrictId !== slice.district.districtId) {
      return null;
    }
    const hasPendingCommand = uiState.pendingCommandIds.length > 0;
    const playerResources = slice.player.resourceBalances ?? {};
    const nowMs = options.nowMs ?? Date.now();
    const tickRateMs = Math.max(1, slice.mode.tickRateMs);
    const selectedBuildingId = slice.district.buildings.some((building) => building.buildingId === uiState.selectedBuildingId) ? uiState.selectedBuildingId : null;
    const basicActions = createDistrictBasicActionViewModels(slice.district, hasPendingCommand);
    return {
      districtId: slice.district.districtId,
      intelKnown: slice.district.intelKnown,
      selectedBuildingId,
      title: slice.district.name,
      ownershipLabel: slice.district.isOwnedByPlayer ? "Vlastní hráč" : slice.district.status === "destroyed" ? "Zničený distrikt" : slice.district.ownerPlayerId ? `Vlastní ${slice.district.ownerPlayerId}` : "Neobsazený distrikt",
      zoneLabel: toTitleCase$3(slice.district.zone),
      statusLabel: slice.district.status,
      heatLabel: formatHeatLabel$1(slice.district.heat),
      influenceLabel: String(slice.district.influence),
      buildingSummary: !slice.district.intelKnown ? "Budovy nezjištěny" : slice.district.status === "destroyed" ? "0 pevných budov · zničeno" : `${slice.district.buildings.length} pevných budov`,
      attackSummary: slice.district.attackTargets.length > 0 ? `${slice.district.attackTargets.filter((target) => target.enabled).length}/${slice.district.attackTargets.length} tras útoku připraveno` : "Žádné sousední trasy útoku",
      hasPendingCommand,
      trap: slice.district.trap ? {
        actionLabel: slice.district.trap.activeTrap ? "Past nastražena" : ((_a = slice.district.trap.relocationSource) == null ? void 0 : _a.canRelocate) ? "Přesunout skrytou past" : "Nastražit skrytou past",
        activeLabel: slice.district.trap.activeTrap ? `${slice.district.trap.activeTrap.label} · tick ${slice.district.trap.activeTrap.placedAtTick}` : ((_b = slice.district.trap.relocationSource) == null ? void 0 : _b.canRelocate) ? "Past je aktivní v jiném vlastním districtu." : null,
        disabled: hasPendingCommand || !slice.district.trap.enabled,
        disabledReason: hasPendingCommand ? "Akce se zpracovává." : slice.district.trap.disabledReason
      } : null,
      spyTargets: slice.district.spyTargets.map((target) => ({
        districtId: target.districtId,
        label: target.name,
        ownerLabel: target.ownerPlayerId ? `Vlastník ${target.ownerPlayerId}` : "Neutrální distrikt",
        statusLabel: target.status,
        disabled: hasPendingCommand || !target.enabled,
        disabledReason: hasPendingCommand ? "Akce se zpracovává." : target.disabledReason
      })),
      occupyTargets: slice.district.occupyTargets.map((target) => ({
        districtId: target.districtId,
        label: target.name,
        statusLabel: target.status,
        disabled: hasPendingCommand || !target.enabled,
        disabledReason: hasPendingCommand ? "Akce se zpracovává." : target.disabledReason,
        disabledCode: target.disabledCode,
        influenceCostLabel: String(target.cost.influence),
        heatGainLabel: `+${target.heatGain}`,
        cooldownLabel: target.cooldownRemainingTicks > 0 ? `${target.cooldownRemainingTicks} ticks` : null
      })),
      robTargets: basicActions.robTargets,
      heistTargets: basicActions.heistTargets,
      placeDefense: basicActions.placeDefense,
      removeDefense: basicActions.removeDefense,
      attackTargets: slice.district.attackTargets.map((target) => ({
        districtId: target.districtId,
        label: target.name,
        ownerLabel: target.ownerPlayerId ? `Vlastník ${target.ownerPlayerId}` : "Neutrální distrikt",
        statusLabel: target.status,
        disabled: hasPendingCommand || !target.enabled,
        disabledReason: hasPendingCommand ? "Akce se zpracovává." : target.disabledReason,
        cooldownLabel: (target.cooldownRemainingTicks ?? 0) > 0 ? `${target.cooldownRemainingTicks} ticks` : null
      })),
      buildings: createDistrictPanelBuildingViewModels(slice.district.buildings, {
        hasPendingCommand,
        nowMs,
        tickRateMs
      }),
      slots: slice.district.slots.map((slot) => ({
        slotIndex: slot.slotIndex,
        buildingTypeId: slot.buildingTypeId,
        title: slot.buildingTypeId ? toTitleCase$3(slot.buildingTypeId) : `Prázdný slot ${slot.slotIndex + 1}`,
        statusLabel: slot.status,
        canBuild: false,
        summaryLabel: slot.processing ? `${slot.processing.label} se zpracovává na server ticku.` : slot.production && slot.craftOptions.length > 0 ? `${slot.production.resourceLabel} běží na server ticku a vybraný sklad se tady dá zpracovat.` : slot.production ? `${slot.production.resourceLabel} běží na server ticku.` : slot.craftOptions.length > 0 ? "Tahle stavba zpracovává vybraný sklad přes serverové recepty." : slot.buildingTypeId ? "Stavba už stojí" : "Tomuto slotu není přiřazená pevná budova.",
        production: slot.production && slot.buildingId ? {
          buildingId: slot.buildingId,
          resourceLabel: slot.production.resourceLabel,
          storageLabel: `${slot.production.storedAmount}/${slot.production.storageCap} připraveno`,
          storagePercent: getStoragePercent(slot.production.storedAmount, slot.production.storageCap),
          playerStockLabel: `${Math.max(0, Number(playerResources[slot.production.resourceKey] || 0))} ve skladu`,
          rateLabel: `${slot.production.amountPerTick}/tick`,
          canCollect: slot.production.canCollect && !hasPendingCommand,
          collectDisabledReason: hasPendingCommand ? "Akce se zpracovává." : slot.production.collectDisabledReason
        } : null,
        processing: slot.processing ? {
          label: slot.processing.label,
          progressLabel: `${Math.max(0, slot.processing.totalTicks - slot.processing.remainingTicks)}/${slot.processing.totalTicks} ticks`,
          completionLabel: `Připraveno za ${formatTickLabel(slot.processing.remainingTicks)}`,
          outputLabel: `+${slot.processing.outputAmount} ${slot.processing.outputResourceLabel}`
        } : null,
        craftOptions: slot.craftOptions.map((option) => ({
          buildingId: slot.buildingId ?? "",
          recipeId: option.recipeId,
          label: option.label,
          inputSummary: option.inputSummary,
          outputAmount: option.outputAmount,
          outputResourceLabel: option.outputResourceLabel,
          playerStockLabel: `${Math.max(0, Number(playerResources[option.outputResourceKey] || 0))} ${option.outputResourceLabel} ve skladu`,
          canCraft: option.canCraft && !hasPendingCommand && Boolean(slot.buildingId),
          disabledReason: hasPendingCommand ? "Akce se zpracovává." : option.craftDisabledReason
        })),
        buildOptions: []
      }))
    };
  };
  const createMapDistrictViewModels = (districts, selectedDistrictId, attackTargets = []) => districts.map((district) => {
    const attackTarget = attackTargets.find((target) => target.districtId === district.districtId);
    const isDestroyed = district.status === "destroyed";
    return {
      districtId: district.districtId,
      label: district.name,
      ownerLabel: isDestroyed ? "Zničený distrikt" : district.isOwnedByPlayer ? "Vlastní hráč" : district.ownerPlayerId ? `Vlastní ${district.ownerPlayerId}` : "Neutrální distrikt",
      zoneLabel: toTitleCase$2(district.zone),
      heatLabel: formatHeatLabel(district.heat),
      influenceLabel: String(district.influence),
      buildingSummary: `${district.filledSlotCount} pevných`,
      ownerPlayerId: district.ownerPlayerId,
      ownerColor: district.ownerColor,
      isOwnedByPlayer: district.isOwnedByPlayer,
      isContested: district.status === "contested",
      isDestroyed,
      isSelected: district.districtId === selectedDistrictId,
      isAttackTarget: attackTarget !== void 0,
      attackEnabled: (attackTarget == null ? void 0 : attackTarget.enabled) ?? false,
      attackDisabledReason: (attackTarget == null ? void 0 : attackTarget.disabledReason) ?? null
    };
  });
  const toTitleCase$2 = (value) => value.split("-").filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
  const formatHeatLabel = (value) => String(Math.round(Number.isFinite(value) ? value : 0));
  const createPlayerViewModel = (view, modeLabelOverride) => view ? {
    playerId: view.playerId,
    instanceId: view.instanceId,
    modeLabel: modeLabelOverride ?? view.mode,
    homeDistrictId: view.homeDistrictId ?? null,
    resourceSummary: view.economy ? formatEconomySummary(view.economy) : formatResourceBalances(view.resourceBalances),
    economy: view.economy ? createEconomyViewModel(view.economy) : null,
    notificationCount: view.notifications.length,
    dayNight: view.dayNight ?? null,
    police: createPoliceViewModel(view)
  } : null;
  const createEconomyViewModel = (economy) => ({
    cleanCashLabel: String(Math.max(0, Number(economy.cleanCash || 0))),
    dirtyCashLabel: String(Math.max(0, Number(economy.dirtyCash || 0))),
    influenceLabel: String(Math.max(0, Number(economy.influence || 0))),
    populationLabel: String(Math.max(0, Number(economy.population || 0))),
    gangMembersLabel: String(Math.max(0, Number(economy.gangMembers || 0)))
  });
  const createPoliceViewModel = (view) => {
    const police = view.police ?? null;
    if (!police) {
      return null;
    }
    const raidConsequenceChangePct = Math.round((1 - police.protection.raidConsequenceMultiplier) * 100);
    const raidConsequenceLabel = raidConsequenceChangePct >= 0 ? `-${raidConsequenceChangePct} % následky raidu` : `+${Math.abs(raidConsequenceChangePct)} % následky raidu`;
    return {
      heatLabel: String(Math.max(0, Number(police.heat || 0))),
      wantedLevelLabel: police.wantedLevelLabel || police.wantedLabel || `${police.wantedLevel} / 5`,
      pendingRaidLabel: police.pendingRaid ? `${police.pendingRaid.severity.toUpperCase()} raid` : null,
      raidConsequenceStatus: police.raidConsequenceStatus || "none",
      selectedDistrictHeatLabel: String(Math.max(0, Number(police.selectedDistrictHeat || 0))),
      protectionLabel: police.protection.sources.length > 0 ? `${police.protection.sources.join(", ")} ${raidConsequenceLabel}` : "žádná"
    };
  };
  const formatEconomySummary = (economy) => {
    const seenResourceIds = /* @__PURE__ */ new Set(["cash", "dirty-cash", "population", "gang-members"]);
    const parts = [
      `Cash ${Math.max(0, Number(economy.cleanCash || 0))}`,
      `Dirty Cash ${Math.max(0, Number(economy.dirtyCash || 0))}`,
      `Vliv ${Math.max(0, Number(economy.influence || 0))}`,
      `Population ${Math.max(0, Number(economy.population || 0))}`
    ];
    for (const balances of [economy.materials, economy.drugs, economy.weapons]) {
      for (const [resourceId, amount] of Object.entries(balances)) {
        seenResourceIds.add(resourceId);
        if (amount > 0) {
          parts.push(`${formatResourceLabel$1(resourceId)} ${amount}`);
        }
      }
    }
    for (const [resourceId, amount] of Object.entries(economy.resources)) {
      if (!seenResourceIds.has(resourceId) && amount > 0) {
        parts.push(`${formatResourceLabel$1(resourceId)} ${amount}`);
      }
    }
    return parts.join(" · ");
  };
  const formatResourceBalances = (balances) => {
    const parts = Object.entries(balances).filter(([, amount]) => amount > 0);
    return parts.length > 0 ? parts.map(([resourceKey, amount]) => `${formatResourceLabel$1(resourceKey)} ${amount}`).join(" · ") : "No resources";
  };
  const RESOURCE_LABELS$1 = {
    "combat-module": "Bojový modul",
    combatModule: "Bojový modul"
  };
  const formatResourceLabel$1 = (value) => RESOURCE_LABELS$1[value] ?? toTitleCase$1(value);
  const toTitleCase$1 = (value) => value.split("-").filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
  const createReportViewModels = (reports) => reports.map((report) => ({
    id: report.reportId,
    reportType: report.reportType,
    title: formatReportTitle(report),
    createdAt: `${report.tick}`,
    category: report.reportType,
    summary: formatReportSummary(report),
    result: report.result,
    severity: formatReportSeverity(report),
    messages: report.reportType === "building-action" ? report.messages ?? [] : report.reportType === "battle" && report.districtDestroyed ? [
      "Stav distriktu: zničený a nepoužitelný.",
      "Vlastník: nikdo.",
      "Pevné budovy: ztraceny.",
      "Všechny hlavní akce distriktu jsou vypnuté."
    ] : [],
    details: formatReportDetails(report)
  }));
  const formatReportTitle = (report) => {
    if (report.reportType === "spy") return `Špehování ${report.result} v ${report.targetDistrictId}`;
    if (report.reportType === "occupy") return `Obsazení ${report.result} v ${report.targetDistrictId}`;
    if (report.reportType === "heist") return `Heist ${report.result} v ${report.targetDistrictId}`;
    if (report.reportType === "rob") return `Vykradení ${report.result} v ${report.targetDistrictId}`;
    if (report.reportType === "building-action") {
      return `${toTitleCase(report.buildingActionId)} v ${report.districtId}`;
    }
    return report.districtDestroyed ? `Katastrofa v distriktu ${report.targetDistrictId}` : `Útok ${report.result} v ${report.targetDistrictId}`;
  };
  const formatReportSummary = (report) => {
    if (report.reportType === "spy") return formatSpySummary(report);
    if (report.reportType === "occupy") {
      return `Distrikt obsazen. Vliv -${report.influenceCost} · hledanost +${report.heatGained}.`;
    }
    if (report.reportType === "heist") {
      return `Kořist ${formatNumberRecord(report.loot)} · ztráty gangu ${report.gangLosses} · hledanost +${report.heatGained}.`;
    }
    if (report.reportType === "rob") {
      return `Kořist ${formatNumberRecord(report.loot)} · hledanost +${report.playerHeat}.`;
    }
    if (report.reportType === "building-action") return formatBuildingActionSummary(report);
    if (report.districtDestroyed) {
      return "Katastrofa zničila distrikt. Kontrola, budovy, hledanost i vliv byly smazány.";
    }
    if (report.trapTriggered) return "Během útoku se spustila past.";
    return report.districtCaptured ? "Distrikt dobyt." : "Distrikt udržel obránce.";
  };
  const formatReportSeverity = (report) => report.reportType === "battle" && report.districtDestroyed ? "critical" : report.reportType === "spy" && report.result === "critical_failed" ? "critical" : report.reportType === "heist" && report.result === "trap_triggered" ? "critical" : "normal";
  const formatReportDetails = (report) => {
    if (report.reportType === "spy") {
      return [
        `Zdroj ${report.sourceDistrictId}`,
        `Cíl ${report.targetDistrictId}`,
        `Intel obrany ${formatNumberRecord(report.detectedDefense)}`,
        report.trapDetected ? "Past odhalena" : "Past neodhalena",
        report.occupyUnlocked ? "Obsazení odemčeno" : "Obsazení neodemčeno",
        report.blockedUntilTick ? `Špeh blokován do ticku ${report.blockedUntilTick}` : ""
      ].filter(Boolean);
    }
    if (report.reportType === "occupy") {
      return [
        `Zdroj ${report.sourceDistrictId}`,
        `Cíl ${report.targetDistrictId}`,
        `Vliv -${report.influenceCost}`,
        `Hledanost +${report.heatGained}`,
        report.previousOwnerPlayerId ? `Předchozí vlastník ${report.previousOwnerPlayerId}` : "Předchozí vlastník nikdo"
      ];
    }
    if (report.reportType === "battle") {
      return [
        `Zdroj ${report.sourceDistrictId}`,
        `Cíl ${report.targetDistrictId}`,
        report.defenderPlayerId ? `Obránce ${report.defenderPlayerId}` : "Obránce nikdo",
        `Výsledek ${toTitleCase(report.outcomeTier)}`,
        `Ztráty útočníka ${formatNumberRecord(report.attackerLosses)}`,
        `Ztráty obránce ${formatNumberRecord(report.defenderLosses)}`,
        `Hledanost +${report.heatGained}`,
        report.reportForAttacker || "Bez shrnutí pro útočníka"
      ];
    }
    if (report.reportType === "heist") {
      return [
        `Zdroj ${report.sourceDistrictId}`,
        `Cíl ${report.targetDistrictId}`,
        `Styl ${toTitleCase(report.style)}`,
        `Kořist ${formatNumberRecord(report.loot)}`,
        `Ztráty gangu ${report.gangLosses}`,
        `Hledanost +${report.heatGained}`
      ];
    }
    if (report.reportType === "rob") {
      return [
        `Zdroj ${report.sourceDistrictId}`,
        `Cíl ${report.targetDistrictId}`,
        `Kořist ${formatNumberRecord(report.loot)}`,
        `Hledanost hráče +${report.playerHeat}`,
        `Hledanost districtu +${report.districtHeat}`,
        `Cooldown ${report.cooldownTicks} ticků`
      ];
    }
    return [
      `Distrikt ${report.districtId}`,
      `Budova ${report.buildingId}`,
      `Výstup ${formatNumberRecord(report.outputGain)}`,
      `Cena ${formatNumberRecord(report.inputCost)}`,
      `Hledanost ${formatSigned(report.heatDelta ?? report.heatGain)}`,
      `Vliv ${formatSigned(report.influenceDelta ?? report.influenceChange)}`,
      report.message ?? ""
    ].filter(Boolean);
  };
  const formatSpySummary = (report) => {
    if (report.result === "success") {
      return report.trapDetected ? "Obrana potvrzena. Past odhalena. Obsazení odemčeno." : "Obrana potvrzena. Obsazení odemčeno.";
    }
    if (report.result === "partial") {
      return "Částečný intel získán. Obsazení zůstává zamčené.";
    }
    if (report.result === "critical_failed") {
      return `Kritické selhání. Obsazení zůstává zamčené. Hledanost +${report.heatGained}.`;
    }
    return "Špehování selhalo. Obsazení zůstává zamčené.";
  };
  const formatBuildingActionSummary = (report) => {
    const parts = [
      formatResourceDelta(report.outputGain),
      formatDefenseDelta(report.defenseAdded ?? {}),
      formatIntelDelta(report.intelRevealedDistrictIds ?? []),
      `Hledanost +${report.heatGain}`,
      `Vliv ${formatSigned(report.influenceChange)}`
    ].filter(Boolean);
    return parts.join(" · ");
  };
  const formatResourceDelta = (values) => {
    const parts = Object.entries(values).filter(([, amount]) => amount > 0);
    return parts.length > 0 ? parts.map(([resourceKey, amount]) => `+${amount} ${formatResourceLabel(resourceKey)}`).join(", ") : "Bez výstupu zdrojů";
  };
  const formatDefenseDelta = (values) => {
    const parts = Object.entries(values).filter(([, amount]) => amount > 0);
    return parts.length > 0 ? `Obrana ${parts.map(([resourceKey, amount]) => `+${amount} ${formatResourceLabel(resourceKey)}`).join(", ")}` : "";
  };
  const formatIntelDelta = (districtIds) => districtIds.length > 0 ? `Intel ${districtIds.length} distriktů` : "";
  const formatSigned = (value) => value >= 0 ? `+${value}` : String(value);
  const formatNumberRecord = (values) => {
    const parts = Object.entries(values).filter(([, amount]) => Number(amount ?? 0) !== 0);
    return parts.length > 0 ? parts.map(([key, amount]) => `${Number(amount)} ${formatResourceLabel(key)}`).join(", ") : "none";
  };
  const RESOURCE_LABELS = {
    "combat-module": "Bojový modul",
    combatModule: "Bojový modul"
  };
  const formatResourceLabel = (resourceKey) => RESOURCE_LABELS[resourceKey] ?? toTitleCase(resourceKey);
  const toTitleCase = (value) => value.replaceAll("_", "-").split("-").filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
  const projectClientControllerState = (store) => {
    var _a, _b, _c, _d, _e;
    const readModel = store.getReadModel();
    const uiState = store.getUiState();
    const player = createPlayerViewModel(
      readModel.playerView,
      (_a = readModel.gameplaySlice) == null ? void 0 : _a.mode.label
    );
    return {
      topBarHtml: "",
      mapHtml: "",
      sidePanelHtml: "",
      player,
      mapDistricts: createMapDistrictViewModels(
        ((_b = readModel.gameplaySlice) == null ? void 0 : _b.districts) ?? [],
        uiState.selectedDistrictId,
        ((_d = (_c = readModel.gameplaySlice) == null ? void 0 : _c.district) == null ? void 0 : _d.attackTargets) ?? []
      ),
      districtPanel: createDistrictPanelViewModel(readModel.gameplaySlice, uiState),
      reports: createReportViewModels(((_e = readModel.gameplaySlice) == null ? void 0 : _e.reports) ?? []),
      errors: readModel.lastErrors,
      connection: readModel.connection,
      lastCommandStatus: uiState.lastCommandStatus
    };
  };
  const empireCityMapManifestHash = "fnv1a32:a3aa0021";
  const getMapManifestMismatch = (response) => {
    var _a, _b, _c;
    const serverHash = ((_a = response.readModel) == null ? void 0 : _a.server.mapManifestHash) ?? null;
    if (!serverHash || serverHash === empireCityMapManifestHash) {
      return null;
    }
    return {
      code: "client.map_manifest_mismatch",
      message: "Client map manifest does not match the server map manifest.",
      details: {
        clientMapManifestHash: empireCityMapManifestHash,
        serverMapManifestHash: serverHash,
        mapManifestId: ((_b = response.readModel) == null ? void 0 : _b.server.mapManifestId) ?? null,
        mapManifestVersion: ((_c = response.readModel) == null ? void 0 : _c.server.mapManifestVersion) ?? null
      }
    };
  };
  const hasCurrentMapManifestMismatch = (slice) => {
    const serverHash = (slice == null ? void 0 : slice.server.mapManifestHash) ?? null;
    return Boolean(serverHash && serverHash !== empireCityMapManifestHash);
  };
  const createServerSliceRenderFingerprint = (readModel, selectedDistrictId) => {
    var _a, _b;
    return readModel ? JSON.stringify({
      instanceId: readModel.server.serverInstanceId,
      playerId: readModel.player.playerId,
      stateVersion: readModel.server.stateVersion,
      currentTick: readModel.server.currentTick,
      selectedDistrictId: ((_a = readModel.district) == null ? void 0 : _a.districtId) ?? readModel.server.selectedDistrictId ?? selectedDistrictId ?? "",
      spawnStatus: ((_b = readModel.spawnSelection) == null ? void 0 : _b.status) || ""
    }) : "";
  };
  const canReuseServerSliceRender = (nextFingerprint, previousFingerprint, commandId, errorCount) => Boolean(
    nextFingerprint && nextFingerprint === previousFingerprint && !commandId && errorCount === 0
  );
  const spawnSelectionFeature = "spawn-selection";
  const createClientResponseCommitter = (options) => {
    let lastCommittedSliceFingerprint = "";
    let nextOperationSequence = 0;
    let lastCommittedOperationSequence = 0;
    const canCommit = (operationSequence) => operationSequence >= lastCommittedOperationSequence;
    const markCommitted = (operationSequence) => {
      lastCommittedOperationSequence = Math.max(lastCommittedOperationSequence, operationSequence);
    };
    return {
      issueOperation: () => ++nextOperationSequence,
      commitResponse: (response, selectedDistrictId, commandId, operationSequence) => {
        var _a, _b, _c;
        if (!canCommit(operationSequence)) return options.getRenderState();
        const hasAuthoritativeReadModel = Boolean(response.readModel);
        const mapManifestMismatch = getMapManifestMismatch(response);
        const responseErrors = mapManifestMismatch ? [...response.errors, mapManifestMismatch] : response.errors;
        const nextSliceFingerprint = createServerSliceRenderFingerprint(response.readModel, selectedDistrictId);
        if (canReuseServerSliceRender(
          nextSliceFingerprint,
          lastCommittedSliceFingerprint,
          commandId,
          responseErrors.length
        )) {
          const currentRenderState = options.getRenderState();
          options.store.setConnectionState({ status: "ready", lastErrorMessage: null, staleData: false });
          markCommitted(operationSequence);
          return currentRenderState.connection.status === "ready" && currentRenderState.connection.lastErrorMessage === null && currentRenderState.connection.staleData === false ? currentRenderState : options.recomputeRenderState("server-slice-connection-restored");
        }
        if (response.readModel) {
          const serverSelectedDistrictId = ((_a = response.readModel.district) == null ? void 0 : _a.districtId) ?? response.readModel.player.homeDistrictId ?? selectedDistrictId ?? null;
          options.store.setGameplaySlice(response.readModel);
          options.store.patchUiState({
            selectedDistrictId: serverSelectedDistrictId,
            activeSidePanel: ((_b = response.readModel.spawnSelection) == null ? void 0 : _b.status) === "awaiting_spawn_selection" ? spawnSelectionFeature : "district-panel"
          });
        }
        if (commandId) {
          options.store.patchUiState({
            lastCommandStatus: { commandId, accepted: response.accepted }
          });
        }
        options.store.setGameplaySliceMetadata(response.metadata ?? (response.readModel ? {
          serverTick: response.readModel.server.currentTick,
          stateVersion: response.readModel.server.stateVersion
        } : null));
        options.store.setErrors(responseErrors);
        options.store.setConnectionState({
          status: hasAuthoritativeReadModel && !mapManifestMismatch ? "ready" : "error",
          lastErrorMessage: ((_c = responseErrors[0]) == null ? void 0 : _c.message) ?? (hasAuthoritativeReadModel ? null : "Gameplay slice response did not include an authoritative read model."),
          staleData: responseErrors.length > 0 || !hasAuthoritativeReadModel
        });
        if (nextSliceFingerprint) lastCommittedSliceFingerprint = nextSliceFingerprint;
        markCommitted(operationSequence);
        return options.recomputeRenderState(commandId ? "server-command-response" : "server-slice-response");
      },
      commitTransportFailure: (message, commandId, operationSequence) => {
        if (!canCommit(operationSequence)) return options.getRenderState();
        const errors = [{ code: "client.transport_error", message }];
        options.store.setErrors(errors);
        options.store.setConnectionState({
          status: "error",
          lastErrorMessage: message,
          staleData: true
        });
        if (commandId) {
          options.store.patchUiState({
            lastCommandStatus: { commandId, accepted: false }
          });
        }
        markCommitted(operationSequence);
        return options.recomputeRenderState("transport-failure");
      }
    };
  };
  const createClientAppShell = (shell) => shell;
  const createInitialClientReadModel = () => ({
    playerView: null,
    gameSnapshot: null,
    gameplaySlice: null,
    gameplaySliceMetadata: null,
    lastErrors: [],
    connection: {
      status: "idle",
      lastErrorMessage: null,
      staleData: false
    }
  });
  const createClientStore = (initialUiState) => {
    let readModel = createInitialClientReadModel();
    let uiState = initialUiState;
    return {
      getReadModel: () => readModel,
      getUiState: () => uiState,
      setServerView: (view) => {
        readModel = {
          ...readModel,
          playerView: view
        };
      },
      setGameSnapshot: (snapshot) => {
        readModel = {
          ...readModel,
          gameSnapshot: snapshot
        };
      },
      setGameplaySlice: (view) => {
        readModel = {
          ...readModel,
          gameplaySlice: view,
          playerView: view.player
        };
      },
      setGameplaySliceMetadata: (metadata) => {
        readModel = {
          ...readModel,
          gameplaySliceMetadata: metadata
        };
      },
      setErrors: (errors) => {
        readModel = {
          ...readModel,
          lastErrors: errors
        };
      },
      setConnectionState: (connection) => {
        readModel = {
          ...readModel,
          connection
        };
      },
      patchUiState: (patch) => {
        uiState = {
          ...uiState,
          ...patch
        };
      }
    };
  };
  const createInitialClientUiState = () => ({
    selectedDistrictId: null,
    selectedBuildingId: null,
    activeSidePanel: null,
    activeModal: null,
    isMapFocused: false,
    pendingCommandIds: [],
    lastCommandStatus: null
  });
  const createCommandDispatcher = (transport) => ({
    dispatch: (request) => transport.send(request)
  });
  const createClientAppCore = ({
    transport,
    projectRenderState,
    onStateRecompute
  }) => {
    const store = createClientStore(createInitialClientUiState());
    const dispatcher = createCommandDispatcher(transport);
    let renderState = projectRenderState(store);
    const recomputeRenderState = (reason) => {
      onStateRecompute == null ? void 0 : onStateRecompute(reason);
      renderState = projectRenderState(store);
      return renderState;
    };
    const responseCommitter = createClientResponseCommitter({
      store,
      getRenderState: () => renderState,
      recomputeRenderState
    });
    recomputeRenderState("initial-client-shell");
    const createLoadRequestForSelectedDistrict = (districtId) => {
      const playerView = store.getReadModel().playerView;
      if (!playerView) {
        return null;
      }
      return {
        serverInstanceId: playerView.instanceId,
        playerId: playerView.playerId,
        districtId,
        factionId: playerView.factionId
      };
    };
    return createClientAppShell({
      load: async (request) => {
        const operationSequence = responseCommitter.issueOperation();
        if (!store.getReadModel().gameplaySlice) {
          store.setConnectionState({
            status: "connecting",
            lastErrorMessage: null,
            staleData: false
          });
        }
        try {
          const response = await transport.load(request);
          return responseCommitter.commitResponse(response, request.districtId, void 0, operationSequence);
        } catch (error) {
          return responseCommitter.commitTransportFailure(
            createTransportFailureMessage("Unable to load gameplay slice from server.", error),
            void 0,
            operationSequence
          );
        }
      },
      clearDistrictSelection: () => {
        store.patchUiState({
          activeSidePanel: null,
          selectedBuildingId: null,
          selectedDistrictId: null
        });
        return recomputeRenderState("ui-clear-district-selection");
      },
      selectDistrict: async (districtId) => {
        const operationSequence = responseCommitter.issueOperation();
        const request = createLoadRequestForSelectedDistrict(districtId);
        if (!request) {
          return responseCommitter.commitTransportFailure(
            "Cannot select a district before the gameplay slice is loaded.",
            void 0,
            operationSequence
          );
        }
        store.setConnectionState({
          status: "connecting",
          lastErrorMessage: null,
          staleData: false
        });
        store.patchUiState({
          selectedBuildingId: null
        });
        recomputeRenderState("ui-select-district-pending");
        try {
          const response = await transport.load(request);
          return responseCommitter.commitResponse(response, districtId, void 0, operationSequence);
        } catch (error) {
          return responseCommitter.commitTransportFailure(
            createTransportFailureMessage("Unable to load selected district from server.", error),
            void 0,
            operationSequence
          );
        }
      },
      selectBuilding: async (buildingId) => {
        store.patchUiState({
          selectedBuildingId: buildingId
        });
        return recomputeRenderState("ui-select-building");
      },
      dispatch: async (command) => {
        var _a;
        const operationSequence = responseCommitter.issueOperation();
        const uiState = store.getUiState();
        const currentSlice = store.getReadModel().gameplaySlice;
        if (hasCurrentMapManifestMismatch(currentSlice)) {
          return responseCommitter.commitTransportFailure(
            "Client map manifest does not match the server map manifest. Map actions are disabled.",
            command.id,
            operationSequence
          );
        }
        if (!uiState.selectedDistrictId && command.type !== "select-spawn-district") {
          return responseCommitter.commitTransportFailure(
            "No district is selected for the district panel slice.",
            command.id,
            operationSequence
          );
        }
        store.patchUiState({
          pendingCommandIds: [...uiState.pendingCommandIds, command.id]
        });
        recomputeRenderState("ui-command-pending");
        const focusDistrictId = command.type === "select-spawn-district" ? command.payload.districtId : uiState.selectedDistrictId;
        try {
          const response = await dispatcher.dispatch({
            command,
            focusDistrictId,
            expectedStateVersion: ((_a = store.getReadModel().gameplaySliceMetadata) == null ? void 0 : _a.stateVersion) ?? null
          });
          store.patchUiState({
            pendingCommandIds: store.getUiState().pendingCommandIds.filter((pendingCommandId) => pendingCommandId !== command.id)
          });
          return responseCommitter.commitResponse(response, uiState.selectedDistrictId, command.id, operationSequence);
        } catch (error) {
          store.patchUiState({
            pendingCommandIds: store.getUiState().pendingCommandIds.filter((pendingCommandId) => pendingCommandId !== command.id)
          });
          return responseCommitter.commitTransportFailure(
            createTransportFailureMessage("Unable to submit gameplay command to server.", error),
            command.id,
            operationSequence
          );
        }
      },
      getRenderState: () => renderState,
      getGameplaySlice: () => store.getReadModel().gameplaySlice
    });
  };
  const createTransportFailureMessage = (fallback, error) => {
    const detail = error instanceof Error ? error.message.trim() : "";
    return detail ? `${fallback} ${detail}` : fallback;
  };
  const createControllerClientApp = ({
    transport,
    onStateRecompute
  }) => createClientAppCore({
    transport,
    projectRenderState: projectClientControllerState,
    onStateRecompute
  });
  const createPlaceDefenseCommand = (input) => {
    const district = input.slice.district;
    if (!district || !district.placeDefense) {
      throw new Error("Place defense command cannot be created from missing district/defense context.");
    }
    if (!district.placeDefense.enabled || !district.placeDefense.preferredItemId) {
      throw new Error("Place defense command cannot be created from a disabled defense projection.");
    }
    return {
      id: input.commandId,
      type: "place-defense",
      mode: input.slice.mode.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        targetDistrictId: district.districtId,
        defenseItemId: district.placeDefense.preferredItemId,
        amount: district.placeDefense.preferredAmount,
        expectedTargetVersion: district.placeDefense.expectedTargetVersion
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createRemoveDefenseCommand = (input) => {
    const district = input.slice.district;
    if (!district || !district.removeDefense) {
      throw new Error("Remove defense command cannot be created from missing district/defense context.");
    }
    if (!district.removeDefense.enabled || !district.removeDefense.preferredItemId) {
      throw new Error("Remove defense command cannot be created from a disabled defense projection.");
    }
    return {
      id: input.commandId,
      type: "remove-defense",
      mode: input.slice.mode.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        targetDistrictId: district.districtId,
        defenseItemId: district.removeDefense.preferredItemId,
        amount: district.removeDefense.preferredAmount,
        expectedTargetVersion: district.removeDefense.expectedTargetVersion
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createAttackDistrictCommand = (input) => {
    var _a, _b;
    const district = input.slice.district;
    const target = ((_a = district == null ? void 0 : district.targetActions) == null ? void 0 : _a.attackTargets.find((entry) => entry.districtId === input.targetDistrictId)) ?? (district == null ? void 0 : district.attackTargets.find((entry) => entry.districtId === input.targetDistrictId));
    const corridor = (_b = input.slice.frontier) == null ? void 0 : _b.corridorTargets.find((entry) => entry.targetDistrictId === input.targetDistrictId);
    if (!district) {
      throw new Error("Attack command cannot be created from missing district/target context.");
    }
    const expectedSourceVersion = input.expectedSourceVersion ?? (target == null ? void 0 : target.expectedSourceVersion);
    const expectedTargetVersion = input.expectedTargetVersion ?? (target == null ? void 0 : target.expectedTargetVersion);
    return {
      id: input.commandId,
      type: "attack-district",
      mode: input.slice.mode.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        districtId: input.targetDistrictId,
        sourceDistrictId: (corridor == null ? void 0 : corridor.sourceDistrictId) ?? (target == null ? void 0 : target.sourceDistrictId) ?? (() => {
          throw new Error("Attack target is missing a source district.");
        })(),
        weapons: { ...input.weapons },
        ...typeof expectedSourceVersion === "number" ? { expectedSourceVersion } : {},
        ...typeof expectedTargetVersion === "number" ? { expectedTargetVersion } : {},
        expectedConflictRevision: (target == null ? void 0 : target.expectedConflictRevision) ?? (() => {
          throw new Error("Attack target is missing a conflict revision.");
        })(),
        ...corridor ? { routeDistrictId: corridor.routeDistrictId, expectedRouteVersion: corridor.routeVersion } : {}
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createHeistDistrictCommand = (input) => {
    var _a, _b, _c;
    const district = input.slice.district;
    const target = ((_a = district == null ? void 0 : district.targetActions) == null ? void 0 : _a.heistTargets.find((entry) => entry.districtId === input.targetDistrictId)) ?? ((_b = district == null ? void 0 : district.heistTargets) == null ? void 0 : _b.find((entry) => entry.districtId === input.targetDistrictId));
    const styleFallback = { style: "balanced", defaultGangMembersSent: 1 };
    const style = (target == null ? void 0 : target.styles.find((entry) => entry.style === "balanced")) ?? (target == null ? void 0 : target.styles[0]) ?? styleFallback;
    const corridor = (_c = input.slice.frontier) == null ? void 0 : _c.corridorTargets.find((entry) => entry.targetDistrictId === input.targetDistrictId);
    if (!district) {
      throw new Error("Heist command cannot be created from missing district/target context.");
    }
    return {
      id: input.commandId,
      type: "heist-district",
      mode: input.slice.mode.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        targetDistrictId: input.targetDistrictId,
        sourceDistrictId: (corridor == null ? void 0 : corridor.sourceDistrictId) ?? (target == null ? void 0 : target.sourceDistrictId) ?? (() => {
          throw new Error("Heist target is missing a source district.");
        })(),
        style: style.style,
        gangMembersSent: style.defaultGangMembersSent,
        expectedConflictRevision: (target == null ? void 0 : target.expectedConflictRevision) ?? (() => {
          throw new Error("Heist target is missing a conflict revision.");
        })(),
        ...(target == null ? void 0 : target.expectedTargetVersion) !== void 0 ? { expectedTargetVersion: target.expectedTargetVersion } : {},
        ...(target == null ? void 0 : target.expectedSourceVersion) !== void 0 ? { expectedSourceVersion: target.expectedSourceVersion } : {},
        ...corridor ? { routeDistrictId: corridor.routeDistrictId, expectedRouteVersion: corridor.routeVersion } : {}
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createOccupyDistrictCommand = (input) => {
    var _a, _b;
    const district = input.slice.district;
    const target = ((_a = district == null ? void 0 : district.targetActions) == null ? void 0 : _a.occupyTargets.find((entry) => entry.districtId === input.targetDistrictId)) ?? (district == null ? void 0 : district.occupyTargets.find((entry) => entry.districtId === input.targetDistrictId));
    const corridor = (_b = input.slice.frontier) == null ? void 0 : _b.corridorTargets.find((entry) => entry.targetDistrictId === input.targetDistrictId);
    if (!district) {
      throw new Error("Occupy command cannot be created from missing district/target context.");
    }
    return {
      id: input.commandId,
      type: "occupy-district",
      mode: input.slice.mode.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        districtId: input.targetDistrictId,
        sourceDistrictId: (corridor == null ? void 0 : corridor.sourceDistrictId) ?? (target == null ? void 0 : target.sourceDistrictId) ?? (() => {
          throw new Error("Occupy target is missing a source district.");
        })(),
        expectedConflictRevision: (target == null ? void 0 : target.expectedConflictRevision) ?? (() => {
          throw new Error("Occupy target is missing a conflict revision.");
        })(),
        ...input.encirclementConfirmationToken ? { encirclementConfirmationToken: input.encirclementConfirmationToken } : {},
        ...corridor ? { routeDistrictId: corridor.routeDistrictId, expectedRouteVersion: corridor.routeVersion } : {}
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createRobDistrictCommand = (input) => {
    var _a, _b, _c;
    const district = input.slice.district;
    const target = ((_a = district == null ? void 0 : district.targetActions) == null ? void 0 : _a.robTargets.find((entry) => entry.districtId === input.targetDistrictId)) ?? ((_b = district == null ? void 0 : district.robTargets) == null ? void 0 : _b.find((entry) => entry.districtId === input.targetDistrictId));
    const corridor = (_c = input.slice.frontier) == null ? void 0 : _c.corridorTargets.find((entry) => entry.targetDistrictId === input.targetDistrictId);
    if (!district) {
      throw new Error("Rob command cannot be created from missing district/target context.");
    }
    return {
      id: input.commandId,
      type: "rob-district",
      mode: input.slice.mode.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        targetDistrictId: input.targetDistrictId,
        sourceDistrictId: (corridor == null ? void 0 : corridor.sourceDistrictId) ?? (target == null ? void 0 : target.sourceDistrictId) ?? (() => {
          throw new Error("Rob target is missing a source district.");
        })(),
        expectedConflictRevision: (target == null ? void 0 : target.expectedConflictRevision) ?? (() => {
          throw new Error("Rob target is missing a conflict revision.");
        })(),
        ...(target == null ? void 0 : target.expectedLootPoolRevision) !== void 0 ? { expectedLootPoolRevision: target.expectedLootPoolRevision } : {},
        ...corridor ? { routeDistrictId: corridor.routeDistrictId, expectedRouteVersion: corridor.routeVersion } : {}
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createSelectSpawnDistrictCommand = (input) => {
    var _a;
    const spawnDistrict = (_a = input.slice.spawnSelection) == null ? void 0 : _a.districts.find(
      (district) => district.districtId === input.districtId
    );
    if (!spawnDistrict || spawnDistrict.status !== "available") {
      throw new Error("Spawn selection commands can only be created from available server-fed spawn districts.");
    }
    return {
      id: input.commandId,
      type: "select-spawn-district",
      mode: input.slice.mode.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        districtId: input.districtId
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createSpyDistrictCommand = (input) => {
    var _a, _b;
    const district = input.slice.district;
    const target = ((_a = district == null ? void 0 : district.targetActions) == null ? void 0 : _a.spyTargets.find((entry) => entry.districtId === input.targetDistrictId)) ?? (district == null ? void 0 : district.spyTargets.find((entry) => entry.districtId === input.targetDistrictId));
    const corridor = (_b = input.slice.frontier) == null ? void 0 : _b.corridorTargets.find((entry) => entry.targetDistrictId === input.targetDistrictId);
    if (!district || !target) {
      throw new Error("Spy command cannot be created from missing district/target context.");
    }
    return {
      id: input.commandId,
      type: "spy-district",
      mode: input.slice.mode.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        districtId: input.targetDistrictId,
        sourceDistrictId: (corridor == null ? void 0 : corridor.sourceDistrictId) ?? target.sourceDistrictId,
        ...corridor ? { routeDistrictId: corridor.routeDistrictId, expectedRouteVersion: corridor.routeVersion } : {}
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createPlaceTrapCommand = (input) => {
    var _a;
    const district = input.slice.district;
    if (!(district == null ? void 0 : district.isOwnedByPlayer) || !((_a = district.trap) == null ? void 0 : _a.enabled)) {
      throw new Error("Trap command cannot be created from missing district/trap context.");
    }
    const relocation = district.trap.relocationSource;
    if (relocation == null ? void 0 : relocation.canRelocate) {
      return {
        id: input.commandId,
        type: "relocate-trap",
        mode: input.slice.mode.mode,
        playerId: input.slice.player.playerId,
        serverInstanceId: input.slice.player.instanceId,
        issuedAt: input.issuedAt,
        payload: {
          trapId: relocation.trapId,
          sourceDistrictId: relocation.districtId,
          targetDistrictId: district.districtId,
          expectedSourceVersion: relocation.expectedSourceVersion,
          expectedTargetVersion: relocation.expectedTargetVersion,
          expectedTrapVersion: relocation.expectedTrapVersion
        },
        clientRequestId: input.clientRequestId ?? null
      };
    }
    return {
      id: input.commandId,
      type: "place-trap",
      mode: input.slice.mode.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        districtId: district.districtId
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createCollectProductionCommand = (input) => ({
    id: input.commandId,
    type: "collect-production",
    mode: input.mode,
    playerId: input.playerId,
    serverInstanceId: input.serverInstanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: input.districtId,
      buildingId: input.buildingId,
      ...input.resourceKey === void 0 ? {} : { resourceKey: input.resourceKey }
    },
    clientRequestId: input.clientRequestId ?? null
  });
  const createCraftItemCommand = (input) => {
    var _a, _b, _c, _d;
    const district = input.slice.district;
    const slot = district == null ? void 0 : district.slots.find((candidate) => candidate.buildingId === input.buildingId);
    const craftOption = slot == null ? void 0 : slot.craftOptions.find((candidate) => candidate.recipeId === input.recipeId && candidate.canCraft);
    const building = district == null ? void 0 : district.buildings.find((candidate) => candidate.buildingId === input.buildingId);
    const productionLine = [
      ...((_a = building == null ? void 0 : building.pharmacy) == null ? void 0 : _a.lines) ?? [],
      ...((_b = building == null ? void 0 : building.drugLab) == null ? void 0 : _b.lines) ?? [],
      ...((_c = building == null ? void 0 : building.factory) == null ? void 0 : _c.productionLines) ?? [],
      ...((_d = building == null ? void 0 : building.armory) == null ? void 0 : _d.productionLines) ?? []
    ].find((candidate) => candidate.recipeId === input.recipeId && candidate.canStart);
    if (!district || !craftOption && !productionLine) {
      throw new Error("Craft commands can only be created from enabled craft options present in the current server-fed slice.");
    }
    return {
      id: input.commandId,
      type: "craft-item",
      mode: input.slice.player.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        districtId: district.districtId,
        buildingId: input.buildingId,
        recipeId: (craftOption == null ? void 0 : craftOption.recipeId) ?? productionLine.recipeId,
        quantity: input.quantity ?? 1
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createRunBuildingActionCommand = (input) => {
    const district = input.slice.district;
    const building = district == null ? void 0 : district.buildings.find((candidate) => candidate.buildingId === input.buildingId);
    const action = building == null ? void 0 : building.actions.find((candidate) => candidate.actionId === input.actionId && candidate.enabled);
    if (!district || !building || !action) {
      throw new Error("Building action commands can only be created from enabled actions present in the current server-fed slice.");
    }
    return {
      id: input.commandId,
      type: "run-building-action",
      mode: input.slice.player.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        districtId: district.districtId,
        buildingId: building.buildingId,
        actionId: action.actionId,
        ...input.dealerSlotId ? { dealerSlotId: input.dealerSlotId } : {},
        ...input.targetCategory ? { targetCategory: input.targetCategory } : {},
        ...input.category ? { category: input.category } : {},
        ...input.mode ? { mode: input.mode } : {},
        ...input.investmentCleanCash !== void 0 ? { investmentCleanCash: input.investmentCleanCash } : {},
        ...input.investment !== void 0 ? { investment: input.investment } : {},
        ...input.targetZone ? { targetZone: input.targetZone } : {},
        ...input.itemId ? { itemId: input.itemId } : {},
        ...input.amount !== void 0 ? { amount: input.amount } : {}
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createCancelProductionCommand = (input) => {
    var _a, _b, _c, _d;
    const district = input.slice.district;
    const building = district == null ? void 0 : district.buildings.find((candidate) => candidate.buildingId === input.buildingId);
    const lines = ((_a = building == null ? void 0 : building.pharmacy) == null ? void 0 : _a.lines) ?? ((_b = building == null ? void 0 : building.drugLab) == null ? void 0 : _b.lines) ?? ((_c = building == null ? void 0 : building.factory) == null ? void 0 : _c.productionLines) ?? ((_d = building == null ? void 0 : building.armory) == null ? void 0 : _d.productionLines) ?? [];
    const line = lines.find(
      (candidate) => candidate.recipeId === input.recipeId && candidate.canCancelWaiting
    );
    if (!district || !building || !line) {
      throw new Error(
        "Production cancellation commands can only be created from cancellable lines present in the current server-fed slice."
      );
    }
    const command = {
      id: input.commandId,
      mode: input.slice.player.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        districtId: district.districtId,
        buildingId: building.buildingId,
        recipeId: line.recipeId
      },
      clientRequestId: input.clientRequestId ?? null
    };
    if (building.buildingTypeId === "pharmacy") {
      return { ...command, type: "cancel-pharmacy-production" };
    }
    if (building.buildingTypeId === "drug_lab") {
      return { ...command, type: "cancel-drug-lab-production" };
    }
    if (building.buildingTypeId === "factory" || building.buildingTypeId === "armory") {
      return { ...command, type: "cancel-production-line" };
    }
    throw new Error("The selected building does not expose a cancellable production command.");
  };
  const canUseOwnedDistrictBuilding = (slice, buildingId) => {
    const district = slice == null ? void 0 : slice.district;
    if (!district) return false;
    const ownsDistrict = district.isOwnedByPlayer || district.ownerPlayerId === slice.player.playerId;
    return ownsDistrict && district.buildings.some((building) => building.buildingId === buildingId);
  };
  const createBuildingSurfaceCommand = ({
    action,
    slice,
    districtId,
    mode,
    issuedAt,
    createCommandId
  }) => {
    if (!canUseOwnedDistrictBuilding(slice, action.buildingId)) return null;
    switch (action.kind) {
      case "building-action":
        return createRunBuildingActionCommand({
          commandId: createCommandId("command:building-action"),
          slice,
          buildingId: action.buildingId,
          actionId: action.actionId,
          dealerSlotId: action.dealerSlotId,
          targetCategory: readStringValue(action, "targetCategory"),
          category: readStringValue(action, "category"),
          mode: readStringValue(action, "mode"),
          investmentCleanCash: readNumberValue(action, "investmentCleanCash"),
          investment: readNumberValue(action, "investment"),
          targetZone: readStringValue(action, "targetZone"),
          itemId: action.itemId,
          amount: action.amount,
          issuedAt
        });
      case "collect":
        return createCollectProductionCommand({
          commandId: createCommandId("command:collect"),
          serverInstanceId: slice.player.instanceId,
          playerId: slice.player.playerId,
          mode,
          districtId,
          buildingId: action.buildingId,
          resourceKey: action.resourceKey,
          issuedAt
        });
      case "craft":
        return createCraftItemCommand({
          commandId: createCommandId("command:craft"),
          slice,
          buildingId: action.buildingId,
          recipeId: action.recipeId,
          quantity: action.quantity,
          issuedAt
        });
      case "cancel-production":
        return createCancelProductionCommand({
          commandId: createCommandId("command:cancel-production"),
          slice,
          buildingId: action.buildingId,
          recipeId: action.recipeId,
          issuedAt
        });
    }
  };
  const readStringValue = (action, key) => {
    const value = action[key];
    return typeof value === "string" && value.trim() ? value : void 0;
  };
  const readNumberValue = (action, key) => {
    const value = action[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
  };
  const resolveClientSurfaceAction = (target) => {
    if (!target) {
      return null;
    }
    const districtButton = target.closest("button[data-district-id]");
    if (districtButton == null ? void 0 : districtButton.dataset.districtId) {
      return { kind: "select-district", districtId: districtButton.dataset.districtId };
    }
    const spawnButton = target.closest("button[data-select-spawn-district-id]");
    if (spawnButton == null ? void 0 : spawnButton.dataset.selectSpawnDistrictId) {
      return { kind: "select-spawn", districtId: spawnButton.dataset.selectSpawnDistrictId };
    }
    const attackButton = target.closest("button[data-attack-target-id]");
    if (attackButton == null ? void 0 : attackButton.dataset.attackTargetId) {
      return { kind: "attack", targetDistrictId: attackButton.dataset.attackTargetId };
    }
    const robButton = target.closest("button[data-rob-target-id]");
    if (robButton == null ? void 0 : robButton.dataset.robTargetId) {
      return { kind: "rob", targetDistrictId: robButton.dataset.robTargetId };
    }
    const heistButton = target.closest("button[data-heist-target-id]");
    if (heistButton == null ? void 0 : heistButton.dataset.heistTargetId) {
      return { kind: "heist", targetDistrictId: heistButton.dataset.heistTargetId };
    }
    const spyButton = target.closest("button[data-spy-target-id]");
    if (spyButton == null ? void 0 : spyButton.dataset.spyTargetId) {
      return { kind: "spy", targetDistrictId: spyButton.dataset.spyTargetId };
    }
    const occupyButton = target.closest("button[data-occupy-target-id]");
    if (occupyButton == null ? void 0 : occupyButton.dataset.occupyTargetId) {
      return { kind: "occupy", targetDistrictId: occupyButton.dataset.occupyTargetId };
    }
    const trapButton = target.closest("button[data-place-trap]");
    if (trapButton) return { kind: "place-trap" };
    const placeDefenseButton = target.closest("button[data-place-defense]");
    if (placeDefenseButton) return { kind: "place-defense" };
    const removeDefenseButton = target.closest("button[data-remove-defense]");
    if (removeDefenseButton) return { kind: "remove-defense" };
    const collectButton = target.closest("button[data-collect-building-id]");
    if (collectButton == null ? void 0 : collectButton.dataset.collectBuildingId) {
      return {
        kind: "collect",
        buildingId: collectButton.dataset.collectBuildingId,
        ...collectButton.dataset.collectResourceKey ? { resourceKey: collectButton.dataset.collectResourceKey } : {}
      };
    }
    const cancelProductionButton = target.closest(
      "button[data-cancel-production-building-id][data-cancel-production-recipe-id]"
    );
    if ((cancelProductionButton == null ? void 0 : cancelProductionButton.dataset.cancelProductionBuildingId) && (cancelProductionButton == null ? void 0 : cancelProductionButton.dataset.cancelProductionRecipeId)) {
      return {
        kind: "cancel-production",
        buildingId: cancelProductionButton.dataset.cancelProductionBuildingId,
        recipeId: cancelProductionButton.dataset.cancelProductionRecipeId
      };
    }
    const buildingAction = resolveBuildingAction(target);
    if (buildingAction) return buildingAction;
    const craftButton = target.closest(
      "button[data-craft-building-id][data-craft-recipe-id]"
    );
    if ((craftButton == null ? void 0 : craftButton.dataset.craftBuildingId) && (craftButton == null ? void 0 : craftButton.dataset.craftRecipeId)) {
      return {
        kind: "craft",
        buildingId: craftButton.dataset.craftBuildingId,
        recipeId: craftButton.dataset.craftRecipeId,
        ...toPositiveInteger(craftButton.dataset.craftQuantity) === void 0 ? {} : { quantity: toPositiveInteger(craftButton.dataset.craftQuantity) }
      };
    }
    const buildingCard = target.closest("article[data-building-id][data-building-type]");
    return (buildingCard == null ? void 0 : buildingCard.dataset.buildingId) ? { kind: "open-building", buildingId: buildingCard.dataset.buildingId } : null;
  };
  const resolveBuildingAction = (target) => {
    var _a, _b, _c;
    const button = target.closest(
      "button[data-building-action-building-id][data-building-action-id]"
    );
    if (!(button == null ? void 0 : button.dataset.buildingActionBuildingId) || !(button == null ? void 0 : button.dataset.buildingActionId)) {
      return null;
    }
    const card = button.closest("article[data-building-id][data-building-type]");
    const controls = button.closest("[data-building-action-controls]");
    const inputScope = controls ?? card;
    const slotInput = (_a = inputScope == null ? void 0 : inputScope.querySelector) == null ? void 0 : _a.call(inputScope, "select[data-dealer-slot-input]");
    const itemInput = (_b = inputScope == null ? void 0 : inputScope.querySelector) == null ? void 0 : _b.call(inputScope, "select[data-dealer-item-input]");
    const amountInput = (_c = inputScope == null ? void 0 : inputScope.querySelector) == null ? void 0 : _c.call(inputScope, "input[data-dealer-amount-input]");
    const inputValues = collectBuildingActionInputValues(inputScope);
    const amount = Number((amountInput == null ? void 0 : amountInput.value) || (amountInput == null ? void 0 : amountInput.dataset.value) || (amountInput == null ? void 0 : amountInput.dataset.dealerAmountValue) || "");
    return {
      kind: "building-action",
      buildingId: button.dataset.buildingActionBuildingId,
      actionId: button.dataset.buildingActionId,
      dealerSlotId: button.dataset.dealerSlotId || (slotInput == null ? void 0 : slotInput.value) || (slotInput == null ? void 0 : slotInput.dataset.value),
      itemId: button.dataset.dealerItemId || (itemInput == null ? void 0 : itemInput.value) || (itemInput == null ? void 0 : itemInput.dataset.value),
      amount: Number.isFinite(amount) && amount > 0 ? amount : readNumberInput(inputValues, "amount"),
      ...inputValues
    };
  };
  const collectBuildingActionInputValues = (buildingCard) => {
    const inputIds = [
      "targetCategory",
      "category",
      "mode",
      "investmentCleanCash",
      "investment",
      "targetZone",
      "amount"
    ];
    return Object.fromEntries(inputIds.map((inputId) => {
      const element = findBuildingActionInput(buildingCard, inputId);
      const value = (element == null ? void 0 : element.value) || (element == null ? void 0 : element.dataset.value);
      const parsed = ["amount", "investment", "investmentCleanCash"].includes(inputId) ? toPositiveNumber(value) : value;
      return [inputId, parsed || void 0];
    }));
  };
  const findBuildingActionInput = (buildingCard, inputId) => {
    var _a;
    const inputs = (_a = buildingCard == null ? void 0 : buildingCard.querySelectorAll) == null ? void 0 : _a.call(buildingCard, "[data-building-action-input]");
    if (!inputs) {
      return null;
    }
    return Array.from(inputs).find((element) => element.dataset.buildingActionInput === inputId) ?? null;
  };
  const readNumberInput = (values, key) => {
    const value = values[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
  };
  const toPositiveNumber = (value) => {
    const parsed = Number(value || "");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : void 0;
  };
  const toPositiveInteger = (value) => {
    const parsed = Number(value || "");
    return Number.isInteger(parsed) && parsed > 0 ? parsed : void 0;
  };
  const createControllerSurfaceActionRouter = (options) => ({
    handleTarget: async (target) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
      const action = resolveClientSurfaceAction(target);
      if (!action) {
        return null;
      }
      if (action.kind === "select-district") {
        if ((_a = options.isDistrictSelectionBlocked) == null ? void 0 : _a.call(options)) {
          return null;
        }
        return options.client.selectDistrict(action.districtId);
      }
      if (action.kind === "select-spawn") {
        const slice2 = options.client.getGameplaySlice();
        if (!slice2) return null;
        const issuedAt2 = (options.getIssuedAt ?? (() => (/* @__PURE__ */ new Date()).toISOString()))();
        return options.client.dispatch(
          createSelectSpawnDistrictCommand({
            commandId: options.createCommandId("command:select-spawn"),
            slice: slice2,
            districtId: action.districtId,
            issuedAt: issuedAt2
          })
        );
      }
      if (action.kind === "open-building") {
        const slice2 = options.client.getGameplaySlice();
        if (!canUseOwnedDistrictBuilding(slice2, action.buildingId)) return null;
        return options.client.selectBuilding(action.buildingId);
      }
      const slice = options.client.getGameplaySlice();
      const district = slice == null ? void 0 : slice.district;
      if (!slice || !district) {
        return null;
      }
      const issuedAt = (options.getIssuedAt ?? (() => (/* @__PURE__ */ new Date()).toISOString()))();
      const mode = slice.mode.mode;
      switch (action.kind) {
        case "attack": {
          const target2 = ((_b = district.targetActions) == null ? void 0 : _b.attackTargets.find((candidate) => candidate.districtId === action.targetDistrictId)) ?? district.attackTargets.find((candidate) => candidate.districtId === action.targetDistrictId);
          const weapons = (target2 == null ? void 0 : target2.selectedLoadout) ?? {};
          const hasSelectedWeapon = Object.values(weapons).some((amount) => Number(amount) > 0);
          if (!(target2 == null ? void 0 : target2.enabled) || !hasSelectedWeapon) return null;
          return options.client.dispatch(
            createAttackDistrictCommand({
              commandId: options.createCommandId("command:attack"),
              slice,
              targetDistrictId: action.targetDistrictId,
              issuedAt,
              weapons,
              expectedSourceVersion: target2.expectedSourceVersion,
              expectedTargetVersion: target2.expectedTargetVersion
            })
          );
        }
        case "rob": {
          const target2 = ((_c = district.targetActions) == null ? void 0 : _c.robTargets.find((candidate) => candidate.districtId === action.targetDistrictId)) ?? ((_d = district.robTargets) == null ? void 0 : _d.find((candidate) => candidate.districtId === action.targetDistrictId));
          if (!(target2 == null ? void 0 : target2.enabled)) return null;
          return options.client.dispatch(
            createRobDistrictCommand({
              commandId: options.createCommandId("command:rob"),
              slice,
              targetDistrictId: action.targetDistrictId,
              issuedAt
            })
          );
        }
        case "heist": {
          const target2 = ((_e = district.targetActions) == null ? void 0 : _e.heistTargets.find((candidate) => candidate.districtId === action.targetDistrictId)) ?? ((_f = district.heistTargets) == null ? void 0 : _f.find((candidate) => candidate.districtId === action.targetDistrictId));
          if (!(target2 == null ? void 0 : target2.enabled)) return null;
          return options.client.dispatch(
            createHeistDistrictCommand({
              commandId: options.createCommandId("command:heist"),
              slice,
              targetDistrictId: action.targetDistrictId,
              issuedAt
            })
          );
        }
        case "spy": {
          const target2 = ((_g = district.targetActions) == null ? void 0 : _g.spyTargets.find((candidate) => candidate.districtId === action.targetDistrictId)) ?? district.spyTargets.find((candidate) => candidate.districtId === action.targetDistrictId);
          if (!(target2 == null ? void 0 : target2.enabled)) return null;
          return options.client.dispatch(
            createSpyDistrictCommand({
              commandId: options.createCommandId("command:spy"),
              slice,
              targetDistrictId: action.targetDistrictId,
              issuedAt
            })
          );
        }
        case "occupy": {
          const target2 = ((_h = district.targetActions) == null ? void 0 : _h.occupyTargets.find((candidate) => candidate.districtId === action.targetDistrictId)) ?? district.occupyTargets.find((candidate) => candidate.districtId === action.targetDistrictId);
          if (!(target2 == null ? void 0 : target2.enabled)) return null;
          return options.client.dispatch(
            createOccupyDistrictCommand({
              commandId: options.createCommandId("command:occupy"),
              slice,
              targetDistrictId: action.targetDistrictId,
              issuedAt
            })
          );
        }
        case "place-trap":
          if (!district.isOwnedByPlayer || !((_i = district.trap) == null ? void 0 : _i.enabled)) return null;
          return options.client.dispatch(
            createPlaceTrapCommand({
              commandId: options.createCommandId("command:trap"),
              slice,
              issuedAt
            })
          );
        case "place-defense":
          if (!((_j = district.placeDefense) == null ? void 0 : _j.enabled)) return null;
          return options.client.dispatch(
            createPlaceDefenseCommand({
              commandId: options.createCommandId("command:place-defense"),
              slice,
              issuedAt
            })
          );
        case "remove-defense":
          if (!((_k = district.removeDefense) == null ? void 0 : _k.enabled)) return null;
          return options.client.dispatch(
            createRemoveDefenseCommand({
              commandId: options.createCommandId("command:remove-defense"),
              slice,
              issuedAt
            })
          );
        case "building-action":
        case "collect":
        case "craft":
        case "cancel-production": {
          const command = createBuildingSurfaceCommand({
            action,
            slice,
            districtId: district.districtId,
            mode,
            issuedAt,
            createCommandId: options.createCommandId
          });
          return command ? options.client.dispatch(command) : null;
        }
        default:
          return null;
      }
    }
  });
  const createFetchClientTransport = (options) => {
    const fetchJson = options.fetchImpl ?? globalThis.fetch;
    const endpointBase = options.endpointBase.replace(/\/+$/u, "");
    const storage = options.storage ?? resolveBrowserStorage();
    let consumedJoinTicket = null;
    const post = async (route, request) => {
      if (!fetchJson) {
        throw new Error("Fetch transport is unavailable in this runtime.");
      }
      const requestWithTokens = attachStoredGameplaySliceTokens(route, request, storage);
      const requestJoinTicket = readJoinTicket(requestWithTokens);
      const shouldStripConsumedJoinTicket = Boolean(
        consumedJoinTicket && requestJoinTicket === consumedJoinTicket
      );
      const requestForEndpoint = shouldStripConsumedJoinTicket ? omitJoinTicket(requestWithTokens) : requestWithTokens;
      const endpointRoute = resolveEndpointRoute(route, requestForEndpoint);
      const endpoint = `${endpointBase}/${endpointRoute}`;
      const response = await fetchJson(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(requestForEndpoint)
      });
      if (!response.ok) {
        throw new Error(`Gameplay slice request failed: POST ${endpoint} returned HTTP ${response.status}.`);
      }
      const payload = await response.json();
      persistGameplaySliceTokens(requestForEndpoint, payload, storage);
      if (endpointRoute === "join" && payload.accepted && requestJoinTicket) {
        consumedJoinTicket = requestJoinTicket;
      }
      return payload;
    };
    return {
      load: (request) => post("load", request),
      send: (request) => post("submit", request)
    };
  };
  const attachStoredGameplaySliceTokens = (route, request, storage) => {
    const snapshotKey = createGameplaySliceTokenStorageKey("snapshot", request);
    const snapshotToken = snapshotKey ? readToken(storage, snapshotKey) : null;
    return snapshotToken ? {
      ...request,
      snapshotToken
    } : request;
  };
  const resolveEndpointRoute = (route, request) => {
    if (route !== "load") {
      return route;
    }
    const record = request;
    return String(record.joinTicket ?? "").trim() ? "join" : "load";
  };
  const readJoinTicket = (request) => {
    const ticket = String((request == null ? void 0 : request.joinTicket) ?? "").trim();
    return ticket || null;
  };
  const omitJoinTicket = (request) => {
    const { joinTicket: _joinTicket, ...rest } = request;
    return rest;
  };
  const persistGameplaySliceTokens = (request, response, storage) => {
    const snapshotKey = createGameplaySliceTokenStorageKey("snapshot", request);
    const snapshotToken = String(response.snapshotToken ?? "").trim();
    if (snapshotKey && snapshotToken) {
      writeToken(storage, snapshotKey, snapshotToken);
    }
  };
  const readToken = (storage, key) => {
    try {
      return (storage == null ? void 0 : storage.getItem(key)) ?? null;
    } catch (_error) {
      return null;
    }
  };
  const writeToken = (storage, key, token) => {
    try {
      storage == null ? void 0 : storage.setItem(key, token);
    } catch (_error) {
    }
  };
  const createGameplaySliceTokenStorageKey = (kind, request) => {
    var _a, _b;
    const record = request;
    const serverInstanceId = String(record.serverInstanceId ?? ((_a = record.command) == null ? void 0 : _a.serverInstanceId) ?? "").trim();
    const playerId = String(record.playerId ?? ((_b = record.command) == null ? void 0 : _b.playerId) ?? "").trim();
    return serverInstanceId && playerId ? `empire:gameplay-slice:${kind}:${serverInstanceId}:${playerId}` : null;
  };
  const resolveBrowserStorage = () => {
    try {
      return globalThis.sessionStorage ?? null;
    } catch (_error) {
      return null;
    }
  };
  const browserTimerDriver = {
    setInterval: (callback, intervalMs) => globalThis.setInterval(callback, intervalMs),
    clearInterval: (handle) => globalThis.clearInterval(handle)
  };
  const createGameplaySlicePoller = ({
    load,
    getRequest,
    intervalMs,
    enabled = true,
    timerDriver = browserTimerDriver,
    visibilityDocument = typeof document === "undefined" ? null : document,
    intervalMultiplier = 1,
    maxErrorIntervalMultiplier = 4,
    onRunningChange,
    onAttempt,
    onSkipped,
    onSuccess,
    getResponseError,
    onResponse,
    onError
  }) => {
    var _a;
    const baseIntervalMs = Math.max(1, Math.floor(intervalMs * Math.max(1, intervalMultiplier)));
    const maxBackoffMultiplier = Math.max(1, Math.floor(maxErrorIntervalMultiplier));
    let intervalHandle = null;
    let currentIntervalMs = baseIntervalMs;
    let consecutiveErrors = 0;
    let refreshInProgress = false;
    let pollingEnabled = enabled;
    let destroyed = false;
    const isPausedForVisibility = () => Boolean(visibilityDocument == null ? void 0 : visibilityDocument.hidden);
    const stop = () => {
      if (intervalHandle === null) {
        return;
      }
      timerDriver.clearInterval(intervalHandle);
      intervalHandle = null;
      onRunningChange == null ? void 0 : onRunningChange(-1);
    };
    const startInterval = () => {
      if (!pollingEnabled || destroyed || intervalHandle !== null || isPausedForVisibility()) {
        return;
      }
      intervalHandle = timerDriver.setInterval(() => {
        if (isPausedForVisibility()) {
          stop();
          return;
        }
        void refreshOnce();
      }, currentIntervalMs);
      onRunningChange == null ? void 0 : onRunningChange(1);
    };
    const restartWithInterval = (nextIntervalMs) => {
      const wasRunning = intervalHandle !== null;
      stop();
      currentIntervalMs = Math.max(1, Math.floor(nextIntervalMs));
      if (wasRunning) {
        startInterval();
      }
    };
    const syncErrorBackoff = () => {
      const multiplier = Math.min(maxBackoffMultiplier, 2 ** consecutiveErrors);
      const nextIntervalMs = baseIntervalMs * multiplier;
      if (nextIntervalMs !== currentIntervalMs) {
        restartWithInterval(nextIntervalMs);
      }
    };
    const resetErrorBackoff = () => {
      if (consecutiveErrors === 0 && currentIntervalMs === baseIntervalMs) {
        return;
      }
      consecutiveErrors = 0;
      if (currentIntervalMs !== baseIntervalMs) {
        restartWithInterval(baseIntervalMs);
      }
    };
    const refreshOnce = async () => {
      if (refreshInProgress) {
        onSkipped == null ? void 0 : onSkipped("in-progress");
        return null;
      }
      if (destroyed) {
        onSkipped == null ? void 0 : onSkipped("destroyed");
        return null;
      }
      if (isPausedForVisibility()) {
        onSkipped == null ? void 0 : onSkipped("hidden");
        return null;
      }
      const request = getRequest();
      if (!request) {
        onSkipped == null ? void 0 : onSkipped("missing-request");
        return null;
      }
      refreshInProgress = true;
      onAttempt == null ? void 0 : onAttempt();
      try {
        const response = await load(request);
        const responseError = (getResponseError == null ? void 0 : getResponseError(response)) ?? null;
        if (responseError !== null) {
          throw responseError;
        }
        await (onResponse == null ? void 0 : onResponse(response));
        onSuccess == null ? void 0 : onSuccess();
        resetErrorBackoff();
        return response;
      } catch (error) {
        consecutiveErrors += 1;
        onError == null ? void 0 : onError(error);
        syncErrorBackoff();
        return null;
      } finally {
        refreshInProgress = false;
      }
    };
    const handleVisibilityChange = () => {
      if (isPausedForVisibility()) {
        stop();
        return;
      }
      if (!pollingEnabled || destroyed) {
        return;
      }
      void refreshOnce();
      startInterval();
    };
    (_a = visibilityDocument == null ? void 0 : visibilityDocument.addEventListener) == null ? void 0 : _a.call(visibilityDocument, "visibilitychange", handleVisibilityChange);
    return {
      start: () => {
        if (!pollingEnabled || intervalHandle !== null) {
          return;
        }
        startInterval();
      },
      stop,
      destroy: () => {
        var _a2;
        if (destroyed) {
          return;
        }
        destroyed = true;
        stop();
        (_a2 = visibilityDocument == null ? void 0 : visibilityDocument.removeEventListener) == null ? void 0 : _a2.call(visibilityDocument, "visibilitychange", handleVisibilityChange);
      },
      isRunning: () => intervalHandle !== null,
      isEnabled: () => pollingEnabled,
      setEnabled: (nextEnabled) => {
        pollingEnabled = nextEnabled;
        if (!pollingEnabled) {
          stop();
        } else {
          startInterval();
        }
      },
      refreshOnce
    };
  };
  const resolveGameplaySliceBootstrapRequest = (dataset, _storage = null) => createExplicitRequest(dataset);
  const createExplicitRequest = (dataset) => {
    const serverInstanceId = normalizeServerInstanceId(dataset.serverInstanceId);
    const playerId = normalizeToken(dataset.playerId);
    const accountId = normalizeToken(dataset.accountId);
    const districtId = normalizeDistrictId(dataset.districtId);
    const factionId = normalizeFactionId(dataset.factionId);
    return serverInstanceId && playerId ? {
      serverInstanceId,
      playerId,
      ...accountId ? { accountId } : {},
      ...districtId ? { districtId } : {},
      factionId
    } : null;
  };
  const normalizeToken = (value) => {
    const normalized = String(value ?? "").trim();
    return normalized.length > 0 ? normalized : null;
  };
  const normalizeServerInstanceId = (value) => {
    const normalized = normalizeToken(value);
    if (!normalized) {
      return null;
    }
    return normalized.startsWith("instance:") ? normalized : null;
  };
  const normalizeDistrictId = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return null;
    }
    if (raw.startsWith("district:")) {
      return raw;
    }
    const numericId = Number.parseInt(raw, 10);
    return numericId > 0 ? `district:${numericId}` : null;
  };
  const normalizeFactionId = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  };
  const GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS = 1e4;
  const createBrowserCommandId = (prefix) => `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  const parseGameplaySlicePollingIntervalMs = (value) => {
    const intervalMs = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS;
  };
  const getPerformanceMetrics = () => {
    var _a;
    window.empireStreetsPerformanceMetrics ?? (window.empireStreetsPerformanceMetrics = {
      activeIntervalsCount: 0,
      gameplaySliceRefreshCount: 0,
      managedIntervalCounts: {}
    });
    (_a = window.empireStreetsPerformanceMetrics).managedIntervalCounts ?? (_a.managedIntervalCounts = {});
    return window.empireStreetsPerformanceMetrics;
  };
  const isPerformanceDebugEnabled = () => {
    var _a;
    return Boolean((_a = window.empireStreetsRuntimeDiagnostics) == null ? void 0 : _a.debugEnabled);
  };
  const serverSliceRefreshTimestamps = [];
  let lastServerSliceFingerprint = "";
  const pruneTimestamps = (timestamps, nowMs) => {
    const cutoff = nowMs - 6e4;
    while (timestamps.length > 0 && (timestamps[0] ?? 0) < cutoff) {
      timestamps.shift();
    }
    return timestamps.length;
  };
  const createServerSliceFingerprint = (gameplaySlice) => {
    var _a, _b;
    if (!gameplaySlice || typeof gameplaySlice !== "object") return "";
    const server = gameplaySlice.server ?? {};
    const player = gameplaySlice.player ?? {};
    return JSON.stringify({
      instanceId: server.serverInstanceId || player.instanceId || "",
      playerId: player.playerId || "",
      stateVersion: server.stateVersion ?? null,
      currentTick: server.currentTick ?? null,
      selectedDistrictId: ((_a = gameplaySlice.district) == null ? void 0 : _a.districtId) || server.selectedDistrictId || "",
      spawnStatus: ((_b = gameplaySlice.spawnSelection) == null ? void 0 : _b.status) || "",
      gamePhase: gameplaySlice.gamePhase || ""
    });
  };
  const trackIntervalMetric = (label, delta) => {
    const metrics = getPerformanceMetrics();
    const counts = metrics.managedIntervalCounts ?? {};
    counts[label] = Math.max(0, (counts[label] ?? 0) + delta);
    metrics.managedIntervalCounts = counts;
    metrics.activeIntervalsCount = Object.values(counts).reduce((sum, count) => sum + Math.max(0, count), 0);
  };
  const recordGameplaySliceRefresh = (gameplaySlice) => {
    var _a, _b;
    const metrics = getPerformanceMetrics();
    const nowMs = Date.now();
    metrics.gameplaySliceRefreshCount = (metrics.gameplaySliceRefreshCount ?? 0) + 1;
    metrics.lastGameplaySliceRefreshAt = nowMs;
    serverSliceRefreshTimestamps.push(nowMs);
    metrics.serverSliceRefreshPerMinute = pruneTimestamps(serverSliceRefreshTimestamps, nowMs);
    const diagnosticsObservation = (_b = (_a = window.empireStreetsRuntimeDiagnostics) == null ? void 0 : _a.observeServerSlice) == null ? void 0 : _b.call(_a, gameplaySlice);
    if (diagnosticsObservation) {
      return diagnosticsObservation;
    }
    const fingerprint = createServerSliceFingerprint(gameplaySlice);
    const changed = Boolean(fingerprint && fingerprint !== lastServerSliceFingerprint);
    if (fingerprint) lastServerSliceFingerprint = fingerprint;
    metrics.runtimeMode = "server-authoritative";
    metrics.serverSliceActive = Boolean(gameplaySlice);
    metrics.localTickActive = false;
    metrics.localProjectionActive = false;
    metrics.demoFallbackActive = false;
    return { changed, fingerprint };
  };
  const recordClientStateRecompute = (reason) => {
    const diagnostics = window.empireStreetsRuntimeDiagnostics;
    if (diagnostics == null ? void 0 : diagnostics.recordClientStateRecompute) {
      diagnostics.recordClientStateRecompute(reason);
      return;
    }
    const metrics = getPerformanceMetrics();
    metrics.clientStateRecomputePerMinute = (metrics.clientStateRecomputePerMinute ?? 0) + 1;
  };
  const recordGameplayPollError = () => {
    if (!isPerformanceDebugEnabled()) return;
    const metrics = getPerformanceMetrics();
    metrics.gameplayPollErrorCount = (metrics.gameplayPollErrorCount ?? 0) + 1;
  };
  const getPollingIntervalMultiplier = () => {
    var _a;
    const multiplier = Number(((_a = window.empireStreetsPerformanceMode) == null ? void 0 : _a.pollingMultiplier) ?? 1);
    return Number.isFinite(multiplier) && multiplier >= 1 ? multiplier : 1;
  };
  const getGameplaySlicePollerPerformanceOptions = () => ({
    visibilityDocument: document,
    intervalMultiplier: getPollingIntervalMultiplier(),
    onRunningChange: (delta) => trackIntervalMetric("gameplay-slice-poller", delta),
    onAttempt: () => {
      if (!isPerformanceDebugEnabled()) return;
      const metrics = getPerformanceMetrics();
      metrics.gameplayPollCount = (metrics.gameplayPollCount ?? 0) + 1;
    },
    onSuccess: () => {
      if (!isPerformanceDebugEnabled()) return;
      const metrics = getPerformanceMetrics();
      metrics.gameplayPollSuccessCount = (metrics.gameplayPollSuccessCount ?? 0) + 1;
    },
    onSkipped: () => {
      if (!isPerformanceDebugEnabled()) return;
      const metrics = getPerformanceMetrics();
      metrics.gameplayPollSkippedCount = (metrics.gameplayPollSkippedCount ?? 0) + 1;
    }
  });
  const setGameplayRuntimeMarker = (root, marker, details = {}) => {
    var _a, _b, _c, _d;
    root.dataset.gameplayRuntime = marker;
    root.dataset.gameplaySliceRuntime = marker;
    root.dataset.gameplaySliceEndpoint = details.endpoint ?? root.dataset.gameplaySliceEndpoint ?? "";
    const serverRuntime = details.serverRuntime ?? (marker === "server-authoritative-ready" || marker === "server-authoritative-error" ? marker : null);
    if (serverRuntime) {
      root.dataset.gameplayServerRuntime = serverRuntime;
    } else {
      delete root.dataset.gameplayServerRuntime;
    }
    if (details.error) {
      root.dataset.gameplaySliceError = sanitizeDiagnosticText(details.error, 180);
    } else {
      delete root.dataset.gameplaySliceError;
    }
    if (details.fallback) {
      root.dataset.gameplayFallback = details.fallback;
    } else {
      delete root.dataset.gameplayFallback;
    }
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.gameplayRuntime = marker;
      if (serverRuntime) {
        document.body.dataset.gameplayServerRuntime = serverRuntime;
      } else {
        delete document.body.dataset.gameplayServerRuntime;
      }
      if (details.fallback) {
        document.body.dataset.gameplayFallback = details.fallback;
      } else {
        delete document.body.dataset.gameplayFallback;
      }
    }
    const diagnostics = typeof window === "undefined" ? null : window.empireStreetsRuntimeDiagnostics;
    if (marker === "server-authoritative-ready") {
      (_a = diagnostics == null ? void 0 : diagnostics.setMode) == null ? void 0 : _a.call(diagnostics, "server-authoritative", {
        serverSliceActive: true,
        reason: "gameplay-slice-ready"
      });
    } else if (marker === "server-authoritative-error") {
      (_b = diagnostics == null ? void 0 : diagnostics.setMode) == null ? void 0 : _b.call(diagnostics, "server-authoritative", {
        serverSliceActive: false,
        reason: "gameplay-slice-error"
      });
    } else if (marker === "legacy-fallback" || details.fallback === "legacy") {
      (_c = diagnostics == null ? void 0 : diagnostics.setMode) == null ? void 0 : _c.call(diagnostics, "legacy-fallback", {
        serverSliceActive: false,
        reason: "legacy-fallback"
      });
    } else if (marker === "demo-ready") {
      (_d = diagnostics == null ? void 0 : diagnostics.setMode) == null ? void 0 : _d.call(diagnostics, "demo", {
        serverSliceActive: false,
        reason: "demo-runtime"
      });
    }
  };
  const isLegacyGameplayFallbackAllowed = () => {
    var _a, _b;
    if (typeof window === "undefined") return false;
    const diagnosticsDecision = (_b = (_a = window.empireStreetsRuntimeDiagnostics) == null ? void 0 : _a.shouldAllowDemoFallback) == null ? void 0 : _b.call(_a);
    if (typeof diagnosticsDecision === "boolean") return diagnosticsDecision;
    const forcedMode = getForcedDevelopmentRuntimeMode();
    return forcedMode === "demo" || forcedMode === "legacy-fallback" || forcedMode === "local";
  };
  const LOCAL_DEMO_SESSION_KEY = "empire:local-demo-session:v1";
  const normalizeSelectedRuntimeMode = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "local-demo") return "demo";
    if (normalized === "server-authoritative" || normalized === "demo" || normalized === "legacy-fallback" || normalized === "local") {
      return normalized;
    }
    return null;
  };
  const getForcedDevelopmentRuntimeMode = () => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (typeof window === "undefined") return null;
    const host = String(window.location.hostname || "").toLowerCase();
    const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
    const queryMode = new URLSearchParams(window.location.search).get("runtimeMode");
    if (queryMode === "server-authoritative") return "server-authoritative";
    if (!isLoopback) {
      removeBrowserStorageItem("sessionStorage", LOCAL_DEMO_SESSION_KEY);
      return "server-authoritative";
    }
    const entrypointMode = normalizeSelectedRuntimeMode(window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__);
    if (entrypointMode) return entrypointMode;
    if (queryMode === "local-demo") return "demo";
    if (readBrowserStorageItem("sessionStorage", LOCAL_DEMO_SESSION_KEY) === "1") return "demo";
    const canUseDevelopmentOverride = isLoopback;
    let requestedMode = null;
    if (canUseDevelopmentOverride) {
      try {
        requestedMode = normalizeSelectedRuntimeMode(
          ((_a = window.empireStreetsRuntimeDiagnostics) == null ? void 0 : _a.requestedMode) || queryMode || readBrowserStorageItem("localStorage", "empire:demo:execution-mode:v1") || (((_b = window.EmpireConfigOverrides) == null ? void 0 : _b.localDemoEnabled) === true ? "demo" : null)
        );
      } catch (_error) {
        requestedMode = null;
      }
    }
    if (requestedMode) return requestedMode;
    return normalizeSelectedRuntimeMode(
      ((_e = (_d = (_c = document.querySelector) == null ? void 0 : _c.call(document, 'meta[name="empire-gameplay-execution-mode"]')) == null ? void 0 : _d.getAttribute) == null ? void 0 : _e.call(_d, "content")) || ((_g = (_f = document.documentElement) == null ? void 0 : _f.dataset) == null ? void 0 : _g.gameplayExecutionMode)
    );
  };
  const readBrowserStorageItem = (storageName, key) => {
    var _a, _b;
    try {
      return ((_b = (_a = window[storageName]) == null ? void 0 : _a.getItem) == null ? void 0 : _b.call(_a, key)) ?? null;
    } catch (_error) {
      return null;
    }
  };
  const removeBrowserStorageItem = (storageName, key) => {
    var _a, _b;
    try {
      (_b = (_a = window[storageName]) == null ? void 0 : _a.removeItem) == null ? void 0 : _b.call(_a, key);
    } catch (_error) {
    }
  };
  const isGameplayDiagnosticsEnabled = () => {
    if (typeof window === "undefined") {
      return false;
    }
    const host = String(window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  };
  const writeGameplaySliceDiagnostic = (endpoint, message) => {
    if (!isGameplayDiagnosticsEnabled()) {
      return;
    }
    console.warn("[gameplay-slice] Server-authoritative runtime is unavailable.", {
      endpoint,
      error: sanitizeDiagnosticText(message, 240)
    });
  };
  const createSafeErrorMessage = (error) => error instanceof Error && error.message.trim() ? error.message.trim() : "Unknown gameplay slice error.";
  const sanitizeDiagnosticText = (value, maxLength) => String(value || "").replace(/(snapshotToken|sessionToken|token)["':=\s]+[^,}\s]+/giu, "$1=<redacted>").replace(/[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/gu, "<redacted-token>").slice(0, maxLength);
  const applyDevelopmentRuntimeOverride = (root) => {
    var _a, _b;
    const forcedMode = getForcedDevelopmentRuntimeMode();
    if (!forcedMode || forcedMode === "server-authoritative") return false;
    setGameplayRuntimeMarker(root, forcedMode === "legacy-fallback" ? "legacy-fallback" : "demo-ready", {
      ...forcedMode === "legacy-fallback" ? { fallback: "legacy" } : {},
      serverRuntime: "not-requested"
    });
    (_b = (_a = window.empireStreetsRuntimeDiagnostics) == null ? void 0 : _a.setMode) == null ? void 0 : _b.call(_a, forcedMode, {
      serverSliceActive: false,
      reason: "configured-runtime-override"
    });
    root.hidden = true;
    return true;
  };
  const markMissingGameplaySessionRuntime = (root) => {
    if (isLegacyGameplayFallbackAllowed()) {
      setGameplayRuntimeMarker(root, "demo-ready", {
        fallback: "legacy",
        serverRuntime: "not-requested"
      });
    } else {
      setGameplayRuntimeMarker(root, "server-authoritative-error", {
        error: "A validated gameplay session is required.",
        serverRuntime: "not-requested"
      });
    }
    root.hidden = true;
  };
  const markGameplaySliceUnavailableRuntime = (root, endpoint, message) => {
    const allowLegacyFallback = isLegacyGameplayFallbackAllowed();
    setGameplayRuntimeMarker(root, allowLegacyFallback ? "legacy-fallback" : "server-authoritative-error", {
      endpoint,
      error: message,
      ...allowLegacyFallback ? { fallback: "legacy" } : {},
      serverRuntime: "server-authoritative-error"
    });
    return allowLegacyFallback;
  };
  const DEFAULT_ENDPOINT_BASE = "/api/gameplay-slice";
  const mountedGameplaySlicePagesByRoot = /* @__PURE__ */ new WeakMap();
  const mountGameplaySlicePage = (options) => {
    const existingMount = mountedGameplaySlicePagesByRoot.get(options.root);
    if (existingMount) return existingMount;
    if (applyDevelopmentRuntimeOverride(options.root)) return null;
    const request = resolveGameplaySliceBootstrapRequest(options.root.dataset);
    if (!request) {
      markMissingGameplaySessionRuntime(options.root);
      return null;
    }
    const endpointBase = options.root.dataset.gameplaySliceEndpointBase || DEFAULT_ENDPOINT_BASE;
    options.root.dataset.gameplaySlicePresentationMode = "controller-only";
    options.root.hidden = true;
    options.root.replaceChildren();
    setGameplayRuntimeMarker(options.root, "initializing", { endpoint: `${endpointBase}/load` });
    const client = createControllerClientApp({
      transport: options.transport ?? createFetchClientTransport({ endpointBase }),
      onStateRecompute: recordClientStateRecompute
    });
    let currentLoadRequest = request;
    let lastPublishedConnectionKey = "";
    const selectDistrictWithPollingFocus = (districtId) => {
      currentLoadRequest = {
        ...currentLoadRequest,
        districtId
      };
      const selection = client.selectDistrict(districtId);
      void selection.then(() => {
        var _a, _b;
        const confirmedDistrictId = (_b = (_a = client.getGameplaySlice()) == null ? void 0 : _a.district) == null ? void 0 : _b.districtId;
        if (confirmedDistrictId && confirmedDistrictId !== districtId) {
          currentLoadRequest = {
            ...currentLoadRequest,
            districtId: confirmedDistrictId
          };
        }
      });
      return selection;
    };
    const router = createControllerSurfaceActionRouter({
      client: {
        ...client,
        selectDistrict: selectDistrictWithPollingFocus
      },
      createCommandId: createBrowserCommandId
    });
    const publishConnectionState = (state) => {
      lastPublishedConnectionKey = JSON.stringify(state.connection);
      document.dispatchEvent(new CustomEvent("empire:gameplay-connection-state", {
        detail: state.connection
      }));
    };
    const hideUnavailableGameplaySlice = (state) => {
      const message = state.connection.lastErrorMessage || "Gameplay slice did not return an authoritative read model.";
      const endpoint = `${endpointBase}/load`;
      markGameplaySliceUnavailableRuntime(options.root, endpoint, message);
      writeGameplaySliceDiagnostic(endpoint, message);
      options.root.dataset.gameplaySliceUnavailable = "true";
      options.root.hidden = true;
      publishConnectionState(state);
    };
    const publish = (state, reason = "controller-update") => {
      var _a, _b;
      const gameplaySlice = client.getGameplaySlice();
      if (!gameplaySlice && state.connection.status === "error") {
        hideUnavailableGameplaySlice(state);
        return;
      }
      delete options.root.dataset.gameplaySliceUnavailable;
      setGameplayRuntimeMarker(options.root, "server-authoritative-ready");
      options.root.dataset.lastClientRenderReason = reason;
      options.root.hidden = true;
      const phase = (_b = (_a = state.player) == null ? void 0 : _a.dayNight) == null ? void 0 : _b.uiThemeHint;
      if (phase) {
        document.body.dataset.cityPhase = phase;
      }
      document.dispatchEvent(new CustomEvent("empire:gameplay-slice-rendered", {
        detail: {
          gameplaySlice,
          playerView: (gameplaySlice == null ? void 0 : gameplaySlice.player) ?? null,
          connection: state.connection,
          renderState: state
        }
      }));
      publishConnectionState(state);
    };
    const poller = createGameplaySlicePoller({
      load: (nextRequest) => client.load(nextRequest),
      getRequest: () => currentLoadRequest,
      intervalMs: parseGameplaySlicePollingIntervalMs(options.root.dataset.gameplaySlicePollingIntervalMs),
      enabled: options.root.dataset.gameplaySlicePolling === "true",
      ...getGameplaySlicePollerPerformanceOptions(),
      getResponseError: (state) => state.connection.status === "error" ? new Error(state.connection.lastErrorMessage || "Gameplay slice polling failed.") : null,
      onResponse: (state) => {
        const observation = recordGameplaySliceRefresh(client.getGameplaySlice());
        const connectionKey = JSON.stringify(state.connection);
        if (observation.changed || connectionKey !== lastPublishedConnectionKey) {
          publish(state, "server-slice-change");
        }
      },
      onError: () => {
        recordGameplayPollError();
        document.dispatchEvent(new CustomEvent("empire:gameplay-connection-state", {
          detail: {
            status: "stale",
            lastErrorMessage: "Obnova ze serveru selhala.",
            staleData: true
          }
        }));
      }
    });
    void client.load(request).then((state) => {
      recordGameplaySliceRefresh(client.getGameplaySlice());
      publish(state, "server-slice-initial-load");
      poller.start();
    }).catch((error) => {
      const message = createSafeErrorMessage(error);
      const state = {
        ...client.getRenderState(),
        connection: {
          status: "error",
          lastErrorMessage: message,
          staleData: true
        }
      };
      hideUnavailableGameplaySlice(state);
    });
    let destroyed = false;
    let unregisterMountedPage = () => {
    };
    const handlePageHide = () => {
      mountedPage.destroy();
    };
    const mountedPage = createMountedGameplaySlicePageExternalPort({
      root: options.root,
      allowExternalSurfaceActions: true,
      closeDistrictSheet: () => false,
      getCurrentReadModel: () => client.getGameplaySlice(),
      getCurrentRenderState: () => client.getRenderState(),
      handleSurfaceAction: (target) => router.handleTarget(target),
      selectDistrict: selectDistrictWithPollingFocus,
      submitCommand: (command) => client.dispatch(command),
      applyState: (state, reason) => {
        recordGameplaySliceRefresh(client.getGameplaySlice());
        publish(state, reason);
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        poller.destroy();
        unregisterMountedPage();
        mountedGameplaySlicePagesByRoot.delete(options.root);
        window.removeEventListener("pagehide", handlePageHide);
      }
    });
    unregisterMountedPage = registerMountedGameplaySlicePage(mountedPage);
    mountedGameplaySlicePagesByRoot.set(options.root, mountedPage);
    window.addEventListener("pagehide", handlePageHide, { once: true });
    return mountedPage;
  };
  installGameplaySlicePageApi(mountGameplaySlicePage);
  const mount = mountGameplaySlicePage;
  const getCurrentReadModel = getCurrentGameplaySliceReadModel;
  const getCurrentRenderState = getCurrentGameplaySliceRenderState;
  const handleSurfaceAction = handleGameplaySliceSurfaceAction;
  const selectDistrict = selectGameplaySliceDistrict;
  const submitCommand = submitGameplaySliceCommand;
  const autoMount = () => Array.from(document.querySelectorAll("[data-gameplay-slice-client]")).map((root) => mountGameplaySlicePage({ root })).filter((mounted) => mounted !== null);
  exports.autoMount = autoMount;
  exports.closeDistrictSheet = closeDistrictSheet;
  exports.createMountedGameplaySlicePageExternalPort = createMountedGameplaySlicePageExternalPort;
  exports.getCurrentGameplaySliceReadModel = getCurrentGameplaySliceReadModel;
  exports.getCurrentGameplaySliceRenderState = getCurrentGameplaySliceRenderState;
  exports.getCurrentReadModel = getCurrentReadModel;
  exports.getCurrentRenderState = getCurrentRenderState;
  exports.handleGameplaySliceSurfaceAction = handleGameplaySliceSurfaceAction;
  exports.handleSurfaceAction = handleSurfaceAction;
  exports.installGameplaySlicePageApi = installGameplaySlicePageApi;
  exports.mount = mount;
  exports.mountGameplaySlicePage = mountGameplaySlicePage;
  exports.registerMountedGameplaySlicePage = registerMountedGameplaySlicePage;
  exports.selectDistrict = selectDistrict;
  exports.selectGameplaySliceDistrict = selectGameplaySliceDistrict;
  exports.setGameplayRuntimeMarker = setGameplayRuntimeMarker;
  exports.submitCommand = submitCommand;
  exports.submitGameplaySliceCommand = submitGameplaySliceCommand;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
