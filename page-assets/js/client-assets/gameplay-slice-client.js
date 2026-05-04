var EmpireGameplaySliceClient = function(exports) {
  "use strict";
  const createClientAppShell = (shell) => shell;
  const createInitialClientRenderState = () => ({
    topBarHtml: "",
    mapHtml: "",
    sidePanelHtml: "",
    player: null,
    mapDistricts: [],
    districtPanel: null,
    reports: [],
    errors: [],
    connection: {
      status: "idle",
      lastErrorMessage: null,
      staleData: false
    }
  });
  const createCollectProductionCommand = (input) => ({
    id: input.commandId,
    type: "collect-production",
    mode: input.mode,
    playerId: input.playerId,
    serverInstanceId: input.serverInstanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: input.districtId,
      buildingId: input.buildingId
    },
    clientRequestId: input.clientRequestId ?? null
  });
  const createCraftItemCommand = (input) => {
    const district = input.slice.district;
    const slot = district == null ? void 0 : district.slots.find((candidate) => candidate.buildingId === input.buildingId);
    const craftOption = slot == null ? void 0 : slot.craftOptions.find((candidate) => candidate.recipeId === input.recipeId && candidate.canCraft);
    if (!district || !slot || !craftOption) {
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
        recipeId: craftOption.recipeId
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const renderBuildingDetailPopup = (building) => {
    const zoneKey = toCssToken$1(building.zoneLabel);
    return [
      `<section class="district-building-popup district-building-popup--${zoneKey}" role="dialog" aria-label="${building.label} detail" data-building-zone="${zoneKey}" data-building-popup-id="${building.buildingId}">`,
      `<header class="district-building-popup__header">`,
      `<div>`,
      `<p class="district-building-popup__eyebrow">${building.zoneLabel} · ${building.roleLabel}</p>`,
      `<h5 class="district-building-popup__title">${building.label}</h5>`,
      `<p class="district-building-popup__type">${building.typeLabel}</p>`,
      `</div>`,
      `<span class="district-building-popup__badge">${building.statusLabel}</span>`,
      `</header>`,
      `<div class="district-building-popup__info-card">`,
      `<span class="district-building-popup__section-label">Info</span>`,
      `<p class="district-building-popup__info">${building.info}</p>`,
      `</div>`,
      `<p class="district-building-popup__section-label">Statistiky</p>`,
      `<div class="district-building-popup__stats">`,
      building.stats.map((stat) => [
        `<span class="district-building-popup__stat">`,
        `<span class="district-building-popup__stat-label">${stat.label}</span>`,
        `<strong class="district-building-popup__stat-value">${stat.value}</strong>`,
        `</span>`
      ].join("")).join(""),
      `</div>`,
      `<div class="district-building-popup__actions">`,
      `<div class="district-building-popup__actions-head">`,
      `<p class="district-building-popup__section-label">Speciální akce</p>`,
      `<span class="district-building-popup__count">${building.specialActions.length}</span>`,
      `</div>`,
      building.specialActions.length > 0 ? [
        `<div class="district-building-popup__action-grid">`,
        building.specialActions.map((action) => renderSpecialAction(building, action)).join(""),
        `</div>`
      ].join("") : `<p class="district-panel__empty-copy">Tahle budova nemá v katalogu speciální akce.</p>`,
      `</div>`,
      `</section>`
    ].join("");
  };
  const renderSpecialAction = (building, action) => {
    const disabledAttribute = action.disabled ? " disabled" : "";
    const reasonAttribute = action.disabledReason ? ` data-disabled-reason="${action.disabledReason}"` : "";
    return [
      `<article class="district-building-popup__action${action.disabled ? " is-disabled" : ""}" data-special-action-id="${action.actionId}">`,
      `<span class="district-building-popup__action-light" aria-hidden="true"></span>`,
      `<div class="district-building-popup__action-copy">`,
      `<span class="district-building-popup__action-state">${action.disabled ? "Blocked" : "Ready"}</span>`,
      `<strong>${action.label}</strong>`,
      `<span>${action.description}</span>`,
      `<div class="district-building-popup__action-metrics">`,
      `<small>${action.effectSummary}</small>`,
      `<small>CD ${renderLiveCooldown$1(action)}</small>`,
      `<small>${action.durationLabel}</small>`,
      `<small>Heat ${action.heatLabel}</small>`,
      `</div>`,
      `</div>`,
      `<button class="district-panel__action-button district-panel__action-button--craft district-building-popup__run-button" data-building-action-building-id="${building.buildingId}" data-building-action-id="${action.actionId}"${disabledAttribute}${reasonAttribute}>Spustit</button>`,
      action.disabledReason ? `<p class="district-panel__action-reason">${action.disabledReason}</p>` : "",
      `</article>`
    ].join("");
  };
  const toCssToken$1 = (value) => String(value || "building").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "building";
  const renderLiveCooldown$1 = (action) => action.cooldownEndsAtMs && action.cooldownRemainingMs > 0 ? [
    `<span data-live-cooldown="true"`,
    ` data-cooldown-ends-at-ms="${action.cooldownEndsAtMs}"`,
    ` data-cooldown-prefix=""`,
    ` data-cooldown-ready-label="Ready after server sync">`,
    action.cooldownLabel.replace(/^Cooldown\s+/u, ""),
    `</span>`
  ].join("") : action.cooldownLabel;
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
        actionId: action.actionId
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const renderBuildingSlot = (slot) => {
    const buildingType = toCssToken(slot.buildingTypeId || "empty");
    const hasProduction = Boolean(slot.production);
    const hasCraft = slot.craftOptions.length > 0;
    return [
      `<section class="district-panel__slot district-panel__slot--${buildingType}" data-slot-index="${slot.slotIndex}" data-slot-status="${slot.statusLabel}" data-slot-building-type="${buildingType}" data-has-production="${hasProduction}" data-has-craft="${hasCraft}">`,
      `<div class="district-panel__slot-head">`,
      `<div class="district-panel__slot-heading">`,
      `<span class="district-panel__slot-icon" aria-hidden="true">${getBuildingIcon(slot.buildingTypeId)}</span>`,
      `<div>`,
      `<p class="district-panel__slot-index">Slot ${slot.slotIndex + 1}</p>`,
      `<h4 class="district-panel__slot-title">${slot.title}</h4>`,
      `</div>`,
      `</div>`,
      `<span class="district-panel__slot-state">${slot.statusLabel}</span>`,
      `</div>`,
      `<p class="district-panel__slot-summary">${slot.summaryLabel}</p>`,
      slot.production ? [
        `<div class="district-panel__production district-panel__production--storage">`,
        `<div class="district-panel__production-head">`,
        `<strong class="district-panel__production-title">${slot.production.resourceLabel}</strong>`,
        `<span class="district-panel__production-rate">${slot.production.rateLabel}</span>`,
        `</div>`,
        `<div class="district-panel__production-bar" style="--production-fill:${slot.production.storagePercent}%">`,
        `<span class="district-panel__production-bar-fill"></span>`,
        `</div>`,
        `<div class="district-panel__production-metrics">`,
        `<span class="district-panel__production-metric">${slot.production.storageLabel}</span>`,
        `<span class="district-panel__production-metric">${slot.production.playerStockLabel}</span>`,
        `</div>`,
        `<div class="district-panel__action-row">`,
        `<button class="district-panel__action-button district-panel__action-button--collect" data-collect-building-id="${slot.production.buildingId}"${slot.production.canCollect ? "" : " disabled"}${slot.production.collectDisabledReason ? ` data-disabled-reason="${slot.production.collectDisabledReason}"` : ""}>Collect ${slot.production.resourceLabel}</button>`,
        slot.production.collectDisabledReason ? `<p class="district-panel__action-reason">${slot.production.collectDisabledReason}</p>` : "",
        `</div>`,
        `</div>`
      ].join("") : "",
      slot.craftOptions.length > 0 ? [
        `<div class="district-panel__production district-panel__production--craft">`,
        `<div class="district-panel__production-head">`,
        `<strong class="district-panel__production-title">Processing slots</strong>`,
        `<span class="district-panel__production-rate">${slot.craftOptions.length} recipe${slot.craftOptions.length === 1 ? "" : "s"}</span>`,
        `</div>`,
        slot.processing ? [
          `<div class="district-panel__production-metrics">`,
          `<span class="district-panel__production-metric">Processing ${slot.processing.label}</span>`,
          `<span class="district-panel__production-metric">${slot.processing.progressLabel}</span>`,
          `<span class="district-panel__production-metric">${slot.processing.completionLabel}</span>`,
          `</div>`,
          `<div class="district-panel__production-metrics">`,
          `<span class="district-panel__production-metric">${slot.processing.outputLabel}</span>`,
          `</div>`
        ].join("") : "",
        slot.craftOptions.map(
          (option) => [
            `<article class="district-panel__craft-option" data-craft-option="${option.recipeId}">`,
            `<div class="district-panel__production-metrics">`,
            `<span class="district-panel__production-metric">Costs ${option.inputSummary}</span>`,
            `<span class="district-panel__production-metric">+${option.outputAmount} ${option.outputResourceLabel}</span>`,
            `<span class="district-panel__production-metric">${option.playerStockLabel}</span>`,
            `</div>`,
            `<div class="district-panel__action-row">`,
            `<button class="district-panel__action-button district-panel__action-button--craft" data-craft-building-id="${option.buildingId}" data-craft-recipe-id="${option.recipeId}"${option.canCraft ? "" : " disabled"}${option.disabledReason ? ` data-disabled-reason="${option.disabledReason}"` : ""}>Process ${option.label}</button>`,
            option.disabledReason ? `<p class="district-panel__action-reason">${option.disabledReason}</p>` : "",
            `</div>`,
            `</article>`
          ].join("")
        ).join(""),
        `</div>`
      ].join("") : "",
      slot.production || slot.craftOptions.length > 0 ? "" : `<p class="district-panel__empty-copy">Fixed buildings for this district are defined by district map data.</p>`,
      "</section>"
    ].join("");
  };
  const renderDistrictBuilding = (building, isOpen = false) => [
    `<article class="district-panel__slot district-panel__slot--${toCssToken(building.buildingTypeId)}" data-building-id="${building.buildingId}" data-building-type="${building.buildingTypeId}">`,
    `<div class="district-panel__slot-head">`,
    `<div class="district-panel__slot-heading">`,
    `<span class="district-panel__slot-icon" aria-hidden="true">${getBuildingIcon(building.buildingTypeId)}</span>`,
    `<div>`,
    `<p class="district-panel__slot-index">${building.typeLabel}</p>`,
    `<h4 class="district-panel__slot-title">${building.label}</h4>`,
    `</div>`,
    `</div>`,
    `<span class="district-panel__slot-state">${building.statusLabel}</span>`,
    `</div>`,
    `<p class="district-panel__slot-summary">${building.summaryLabel}</p>`,
    `<details class="district-building-popup-host" data-building-popup-target="${building.buildingId}"${isOpen ? " open" : ""}>`,
    `<summary class="district-panel__action-button district-panel__action-button--info">Stats / Info / Speciální akce</summary>`,
    renderBuildingDetailPopup(building),
    `</details>`,
    building.actions.length > 0 ? building.actions.map((action) => {
      const disabledAttribute = action.disabled ? " disabled" : "";
      const reasonAttribute = action.disabledReason ? ` data-disabled-reason="${action.disabledReason}"` : "";
      return [
        `<div class="district-panel__production">`,
        `<div class="district-panel__production-head">`,
        `<strong class="district-panel__production-title">${action.label}</strong>`,
        `<span class="district-panel__production-rate">${renderLiveCooldown(action)}</span>`,
        `</div>`,
        `<p class="district-panel__slot-summary">${action.description}</p>`,
        `<div class="district-panel__production-metrics">`,
        `<span class="district-panel__production-metric">Cost ${action.inputSummary}</span>`,
        `<span class="district-panel__production-metric">Gain ${action.outputSummary}</span>`,
        `<span class="district-panel__production-metric">Heat ${action.heatLabel}</span>`,
        `<span class="district-panel__production-metric">Influence ${action.influenceLabel}</span>`,
        `</div>`,
        `<div class="district-panel__action-row">`,
        `<button class="district-panel__action-button district-panel__action-button--craft" data-building-action-building-id="${building.buildingId}" data-building-action-id="${action.actionId}"${disabledAttribute}${reasonAttribute}>${action.label}</button>`,
        action.disabledReason ? `<p class="district-panel__action-reason">${action.disabledReason}</p>` : "",
        `</div>`,
        `</div>`
      ].join("");
    }).join("") : `<p class="district-panel__empty-copy">No server-fed building actions are available for this fixed building.</p>`,
    `</article>`
  ].join("");
  const getBuildingIcon = (buildingTypeId) => {
    switch (buildingTypeId) {
      case "pharmacy":
        return "+";
      case "drug_lab":
        return "◆";
      case "factory":
        return "▦";
      case "armory":
        return "✶";
      case "warehouse":
        return "▣";
      default:
        return "•";
    }
  };
  const toCssToken = (value) => String(value || "building").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "building";
  const renderLiveCooldown = (action) => action.cooldownEndsAtMs && action.cooldownRemainingMs > 0 ? [
    `<span data-live-cooldown="true"`,
    ` data-cooldown-ends-at-ms="${action.cooldownEndsAtMs}"`,
    ` data-cooldown-prefix="Cooldown "`,
    ` data-cooldown-ready-label="Ready after server sync">`,
    action.cooldownLabel,
    `</span>`
  ].join("") : action.cooldownLabel;
  const createAttackDistrictCommand = (input) => ({
    id: input.commandId,
    type: "attack-district",
    mode: input.mode,
    playerId: input.playerId,
    serverInstanceId: input.serverInstanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: input.targetDistrictId,
      sourceDistrictId: input.sourceDistrictId
    },
    clientRequestId: input.clientRequestId ?? null
  });
  const createSpyDistrictCommand = (input) => {
    const district = input.slice.district;
    const target = district == null ? void 0 : district.spyTargets.find((entry) => entry.districtId === input.targetDistrictId);
    if (!district || !target || !target.enabled) {
      throw new Error("Spy commands can only be created from enabled spy targets present in the current server-fed slice.");
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
        sourceDistrictId: district.districtId
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createPlaceTrapCommand = (input) => {
    const district = input.slice.district;
    if (!(district == null ? void 0 : district.trap) || !district.trap.enabled) {
      throw new Error("Trap commands can only be created from an enabled trap action present in the current server-fed slice.");
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
  const districtPanelFeature = "district-panel";
  const renderDistrictPanel = (panel) => panel.statusLabel === "destroyed" ? [
    `<section class="district-destroyed-notice" data-feature="district-destroyed-notice" data-district-id="${panel.districtId}" data-district-destroyed="true" role="status" aria-label="Destroyed district">`,
    `<p>V piči, zničen.</p>`,
    `</section>`
  ].join("") : [
    `<section class="district-panel" data-feature="${districtPanelFeature}" data-district-id="${panel.districtId}">`,
    `<header class="district-panel__header">`,
    `<p class="district-panel__eyebrow">District panel</p>`,
    `<h2 class="district-panel__title">${panel.title}</h2>`,
    `<div class="district-panel__badges">`,
    `<span class="district-panel__badge district-panel__badge--owner">${panel.ownershipLabel}</span>`,
    `<span class="district-panel__badge district-panel__badge--status">${panel.statusLabel}</span>`,
    panel.hasPendingCommand ? `<span class="district-panel__badge district-panel__badge--pending">Command pending</span>` : "",
    `</div>`,
    `</header>`,
    `<section class="district-panel__summary-grid" aria-label="District overview">`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Ownership</span><strong class="district-panel__summary-value">${panel.ownershipLabel}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Zone</span><strong class="district-panel__summary-value">${panel.zoneLabel}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Heat</span><strong class="district-panel__summary-value">${panel.heatLabel}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Influence</span><strong class="district-panel__summary-value">${panel.influenceLabel}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Buildings</span><strong class="district-panel__summary-value">${panel.buildingSummary}</strong></article>`,
    `</section>`,
    panel.trap ? [
      `<section class="district-panel__section" data-trap-action="true">`,
      `<div class="district-panel__section-head">`,
      `<div>`,
      `<h3 class="district-panel__section-title">Trap</h3>`,
      `<p class="district-panel__section-copy">Arm one hidden trap on your owned district. Enemy players only learn about it through reports.</p>`,
      `</div>`,
      `<span class="district-panel__section-meta">${panel.trap.activeLabel ? "Armed" : "Ready"}</span>`,
      `</div>`,
      `<div class="district-panel__action-row">`,
      `<button class="district-panel__action-button district-panel__action-button--trap" data-place-trap="true"${panel.trap.disabled ? " disabled" : ""}${panel.trap.disabledReason ? ` data-disabled-reason="${panel.trap.disabledReason}"` : ""}>${panel.trap.actionLabel}</button>`,
      panel.trap.disabledReason ? `<p class="district-panel__action-reason">${panel.trap.disabledReason}</p>` : panel.trap.activeLabel ? `<p class="district-panel__action-reason">${panel.trap.activeLabel}</p>` : "",
      `</div>`,
      `</section>`
    ].join("") : "",
    `<section class="district-panel__section" data-spy-targets="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Spy Targets</h3>`,
    `<p class="district-panel__section-copy">Dispatch one scouting command from this district. Reports stay server-authoritative.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${panel.spyTargets.length} total</span>`,
    `</div>`,
    panel.spyTargets.length > 0 ? panel.spyTargets.map((target) => {
      const disabledAttribute = target.disabled ? " disabled" : "";
      const reasonAttribute = target.disabledReason ? ` data-disabled-reason="${target.disabledReason}"` : "";
      return [
        `<div class="district-panel__action-row">`,
        `<button class="district-panel__action-button district-panel__action-button--spy" data-spy-target-id="${target.districtId}"${disabledAttribute}${reasonAttribute}>`,
        `<span class="district-panel__action-title">${target.label}</span>`,
        `<span class="district-panel__action-meta">${target.ownerLabel} · ${target.statusLabel}</span>`,
        `</button>`,
        target.disabledReason ? `<p class="district-panel__action-reason">${target.disabledReason}</p>` : "",
        `</div>`
      ].join("");
    }).join("") : `<p class="district-panel__empty-copy">No spy targets are available for this district.</p>`,
    `</section>`,
    `<section class="district-panel__section" data-attack-targets="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Attack Targets</h3>`,
    `<p class="district-panel__section-copy">Pick an adjacent district to dispatch an attack command.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${panel.attackTargets.length} total</span>`,
    `</div>`,
    panel.attackTargets.length > 0 ? panel.attackTargets.map((target) => {
      const disabledAttribute = target.disabled ? " disabled" : "";
      const reasonAttribute = target.disabledReason ? ` data-disabled-reason="${target.disabledReason}"` : "";
      return [
        `<div class="district-panel__action-row">`,
        `<button class="district-panel__action-button district-panel__action-button--attack" data-attack-target-id="${target.districtId}"${disabledAttribute}${reasonAttribute}>`,
        `<span class="district-panel__action-title">${target.label}</span>`,
        `<span class="district-panel__action-meta">${target.ownerLabel} · ${target.statusLabel}</span>`,
        `</button>`,
        target.disabledReason ? `<p class="district-panel__action-reason">${target.disabledReason}</p>` : "",
        `</div>`
      ].join("");
    }).join("") : `<p class="district-panel__empty-copy">No attack targets are available for this district.</p>`,
    `</section>`,
    `<section class="district-panel__section">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">District buildings</h3>`,
    `<p class="district-panel__section-copy">Buildings are fixed by district map data. Run server-authoritative actions from each building.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${panel.buildings.length} fixed</span>`,
    `</div>`,
    `<div class="district-panel__slot-list">`,
    panel.buildings.length > 0 ? panel.buildings.map((building) => renderDistrictBuilding(building, building.buildingId === panel.selectedBuildingId)).join("") : `<p class="district-panel__empty-copy">No fixed buildings are assigned to this district projection.</p>`,
    `</div>`,
    `</section>`,
    panel.slots.some((slot) => slot.production || slot.craftOptions.length > 0) ? [
      `<section class="district-panel__section" data-production-slots="true">`,
      `<div class="district-panel__section-head">`,
      `<div>`,
      `<h3 class="district-panel__section-title">Production slots</h3>`,
      `<p class="district-panel__section-copy">Fixed production buildings expose storage, processing and craft slots here.</p>`,
      `</div>`,
      `<span class="district-panel__section-meta">${panel.slots.filter((slot) => slot.production || slot.craftOptions.length > 0).length} active</span>`,
      `</div>`,
      `<div class="district-panel__slot-list district-panel__slot-list--production">`,
      panel.slots.filter((slot) => slot.production || slot.craftOptions.length > 0).map((slot) => renderBuildingSlot(slot)).join(""),
      `</div>`,
      `</section>`
    ].join("") : "",
    "</section>"
  ].join("");
  const createClientSurfaceActionRouter = (options) => ({
    handleTarget: async (target) => {
      const action = resolveClientSurfaceAction(target);
      if (!action) {
        return null;
      }
      if (action.kind === "select-district") {
        return options.client.selectDistrict(action.districtId);
      }
      if (action.kind === "open-building") {
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
        case "attack":
          return options.client.dispatch(
            createAttackDistrictCommand({
              commandId: options.createCommandId("command:attack"),
              serverInstanceId: slice.player.instanceId,
              playerId: slice.player.playerId,
              mode,
              sourceDistrictId: district.districtId,
              targetDistrictId: action.targetDistrictId,
              issuedAt
            })
          );
        case "spy":
          return options.client.dispatch(
            createSpyDistrictCommand({
              commandId: options.createCommandId("command:spy"),
              slice,
              targetDistrictId: action.targetDistrictId,
              issuedAt
            })
          );
        case "place-trap":
          return options.client.dispatch(
            createPlaceTrapCommand({
              commandId: options.createCommandId("command:trap"),
              slice,
              issuedAt
            })
          );
        case "building-action":
          return options.client.dispatch(
            createRunBuildingActionCommand({
              commandId: options.createCommandId("command:building-action"),
              slice,
              buildingId: action.buildingId,
              actionId: action.actionId,
              issuedAt
            })
          );
        case "collect":
          return options.client.dispatch(
            createCollectProductionCommand({
              commandId: options.createCommandId("command:collect"),
              serverInstanceId: slice.player.instanceId,
              playerId: slice.player.playerId,
              mode,
              districtId: district.districtId,
              buildingId: action.buildingId,
              issuedAt
            })
          );
        case "craft":
          return options.client.dispatch(
            createCraftItemCommand({
              commandId: options.createCommandId("command:craft"),
              slice,
              buildingId: action.buildingId,
              recipeId: action.recipeId,
              issuedAt
            })
          );
        default:
          return null;
      }
    }
  });
  const resolveClientSurfaceAction = (target) => {
    if (!target) {
      return null;
    }
    const districtButton = target.closest("button[data-district-id]");
    if (districtButton == null ? void 0 : districtButton.dataset.districtId) {
      return {
        kind: "select-district",
        districtId: districtButton.dataset.districtId
      };
    }
    const attackButton = target.closest("button[data-attack-target-id]");
    if (attackButton == null ? void 0 : attackButton.dataset.attackTargetId) {
      return {
        kind: "attack",
        targetDistrictId: attackButton.dataset.attackTargetId
      };
    }
    const spyButton = target.closest("button[data-spy-target-id]");
    if (spyButton == null ? void 0 : spyButton.dataset.spyTargetId) {
      return {
        kind: "spy",
        targetDistrictId: spyButton.dataset.spyTargetId
      };
    }
    const trapButton = target.closest("button[data-place-trap]");
    if (trapButton) {
      return {
        kind: "place-trap"
      };
    }
    const collectButton = target.closest("button[data-collect-building-id]");
    if (collectButton == null ? void 0 : collectButton.dataset.collectBuildingId) {
      return {
        kind: "collect",
        buildingId: collectButton.dataset.collectBuildingId
      };
    }
    const buildingActionButton = target.closest(
      "button[data-building-action-building-id][data-building-action-id]"
    );
    if ((buildingActionButton == null ? void 0 : buildingActionButton.dataset.buildingActionBuildingId) && (buildingActionButton == null ? void 0 : buildingActionButton.dataset.buildingActionId)) {
      return {
        kind: "building-action",
        buildingId: buildingActionButton.dataset.buildingActionBuildingId,
        actionId: buildingActionButton.dataset.buildingActionId
      };
    }
    const craftButton = target.closest(
      "button[data-craft-building-id][data-craft-recipe-id]"
    );
    if ((craftButton == null ? void 0 : craftButton.dataset.craftBuildingId) && (craftButton == null ? void 0 : craftButton.dataset.craftRecipeId)) {
      return {
        kind: "craft",
        buildingId: craftButton.dataset.craftBuildingId,
        recipeId: craftButton.dataset.craftRecipeId
      };
    }
    const buildingCard = target.closest("article[data-building-id][data-building-type]");
    if (buildingCard == null ? void 0 : buildingCard.dataset.buildingId) {
      return {
        kind: "open-building",
        buildingId: buildingCard.dataset.buildingId
      };
    }
    return null;
  };
  const createInitialClientReadModel = () => ({
    playerView: null,
    gameSnapshot: null,
    gameplaySlice: null,
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
    pendingCommandIds: []
  });
  const createCommandDispatcher = (transport) => ({
    dispatch: (request) => transport.send(request)
  });
  const createFetchClientTransport = (options) => {
    const fetchJson = options.fetchImpl ?? globalThis.fetch;
    const endpointBase = options.endpointBase.replace(/\/+$/u, "");
    const storage = options.storage ?? resolveBrowserStorage();
    const post = async (route, request) => {
      if (!fetchJson) {
        throw new Error("Fetch transport is unavailable in this runtime.");
      }
      const requestWithSnapshotToken = attachSnapshotToken(request, storage);
      const response = await fetchJson(`${endpointBase}/${route}`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(requestWithSnapshotToken)
      });
      if (!response.ok) {
        throw new Error(`Gameplay slice request failed with HTTP ${response.status}.`);
      }
      const payload = await response.json();
      persistSnapshotToken(requestWithSnapshotToken, payload, storage);
      return payload;
    };
    return {
      load: (request) => post("load", request),
      send: (request) => post("submit", request)
    };
  };
  const attachSnapshotToken = (request, storage) => {
    const key = createSnapshotTokenStorageKey(request);
    const snapshotToken = key ? readSnapshotToken(storage, key) : null;
    return snapshotToken ? {
      ...request,
      snapshotToken
    } : request;
  };
  const persistSnapshotToken = (request, response, storage) => {
    const key = createSnapshotTokenStorageKey(request);
    const snapshotToken = String(response.snapshotToken ?? "").trim();
    if (key && snapshotToken) {
      writeSnapshotToken(storage, key, snapshotToken);
    }
  };
  const readSnapshotToken = (storage, key) => {
    try {
      return (storage == null ? void 0 : storage.getItem(key)) ?? null;
    } catch (_error) {
      return null;
    }
  };
  const writeSnapshotToken = (storage, key, snapshotToken) => {
    try {
      storage == null ? void 0 : storage.setItem(key, snapshotToken);
    } catch (_error) {
    }
  };
  const createSnapshotTokenStorageKey = (request) => {
    var _a, _b;
    const record = request;
    const serverInstanceId = String(record.serverInstanceId ?? ((_a = record.command) == null ? void 0 : _a.serverInstanceId) ?? "").trim();
    const playerId = String(record.playerId ?? ((_b = record.command) == null ? void 0 : _b.playerId) ?? "").trim();
    return serverInstanceId && playerId ? `empire:gameplay-slice:snapshot:${serverInstanceId}:${playerId}` : null;
  };
  const resolveBrowserStorage = () => {
    try {
      return globalThis.localStorage ?? null;
    } catch (_error) {
      return null;
    }
  };
  const renderMap = ({ districts, selectedDistrictId }) => [
    `<section data-map-surface="district-list" data-selected-district-id="${selectedDistrictId ?? ""}">`,
    districts.map(
      (district) => {
        const ownerColorAttribute = district.ownerColor ? ` data-owner-color="${district.ownerColor}" style="--map-owner-color:${district.ownerColor}"` : "";
        return district.isDestroyed ? [
          `<button class="map-district map-district--destroyed" data-district-id="${district.districtId}" data-selected="${district.isSelected}" data-owned="${district.isOwnedByPlayer}" data-destroyed="true" data-attack-target="${district.isAttackTarget}" data-attack-enabled="false">`,
          `<span class="map-district__ruin-cracks" aria-hidden="true"></span>`,
          `<strong>${district.label}</strong>`,
          `<span>V piči, zničen.</span>`,
          `</button>`
        ].join("") : [
          `<button class="map-district" data-district-id="${district.districtId}" data-selected="${district.isSelected}" data-owned="${district.isOwnedByPlayer}" data-destroyed="false" data-attack-target="${district.isAttackTarget}" data-attack-enabled="${district.attackEnabled}"${ownerColorAttribute}>`,
          `<strong>${district.label}</strong>`,
          `<span>${district.ownerLabel}</span>`,
          `<span>Zone: ${district.zoneLabel}</span>`,
          `<span>Buildings: ${district.buildingSummary}</span>`,
          `<span>Heat: ${district.heatLabel} · Influence: ${district.influenceLabel}</span>`,
          district.isAttackTarget ? `<span>${district.attackEnabled ? "Attack Ready" : district.attackDisabledReason ?? "Attack unavailable"}</span>` : "",
          district.isContested ? "<span>Contested</span>" : "",
          "</button>"
        ].join("");
      }
    ).join(""),
    "</section>"
  ].join("");
  const createDistrictPanelViewModel = (slice, uiState, options = {}) => {
    if (!(slice == null ? void 0 : slice.district) || uiState.selectedDistrictId !== slice.district.districtId) {
      return null;
    }
    const hasPendingCommand = uiState.pendingCommandIds.length > 0;
    const playerResources = slice.player.resourceBalances ?? {};
    const nowMs = options.nowMs ?? Date.now();
    const tickRateMs = Math.max(1, slice.mode.tickRateMs);
    const selectedBuildingId = slice.district.buildings.some((building) => building.buildingId === uiState.selectedBuildingId) ? uiState.selectedBuildingId : null;
    return {
      districtId: slice.district.districtId,
      selectedBuildingId,
      title: slice.district.name,
      ownershipLabel: slice.district.isOwnedByPlayer ? "Owned by current player" : slice.district.status === "destroyed" ? "Destroyed district" : slice.district.ownerPlayerId ? `Owned by ${slice.district.ownerPlayerId}` : "Unclaimed district",
      zoneLabel: toTitleCase$3(slice.district.zone),
      statusLabel: slice.district.status,
      heatLabel: String(slice.district.heat),
      influenceLabel: String(slice.district.influence),
      buildingSummary: slice.district.status === "destroyed" ? "0 fixed buildings · destroyed" : `${slice.district.buildings.length} fixed buildings`,
      attackSummary: slice.district.attackTargets.length > 0 ? `${slice.district.attackTargets.filter((target) => target.enabled).length}/${slice.district.attackTargets.length} attack routes ready` : "No adjacent attack routes",
      hasPendingCommand,
      trap: slice.district.trap ? {
        actionLabel: slice.district.trap.activeTrap ? "Trap armed" : "Arm hidden trap",
        activeLabel: slice.district.trap.activeTrap ? `${slice.district.trap.activeTrap.label} · tick ${slice.district.trap.activeTrap.placedAtTick}` : null,
        disabled: hasPendingCommand || !slice.district.trap.enabled,
        disabledReason: hasPendingCommand ? "Command pending." : slice.district.trap.disabledReason
      } : null,
      spyTargets: slice.district.spyTargets.map((target) => ({
        districtId: target.districtId,
        label: target.name,
        ownerLabel: target.ownerPlayerId ? `Owner ${target.ownerPlayerId}` : "Neutral district",
        statusLabel: target.status,
        disabled: hasPendingCommand || !target.enabled,
        disabledReason: hasPendingCommand ? "Command pending." : target.disabledReason
      })),
      attackTargets: slice.district.attackTargets.map((target) => ({
        districtId: target.districtId,
        label: target.name,
        ownerLabel: target.ownerPlayerId ? `Owner ${target.ownerPlayerId}` : "Neutral district",
        statusLabel: target.status,
        disabled: hasPendingCommand || !target.enabled,
        disabledReason: hasPendingCommand ? "Command pending." : target.disabledReason
      })),
      buildings: slice.district.buildings.map((building) => ({
        buildingId: building.buildingId,
        buildingTypeId: building.buildingTypeId,
        label: building.displayName || building.label,
        variantName: building.variantName,
        typeLabel: building.label,
        zoneLabel: toTitleCase$3(building.zone),
        roleLabel: building.role,
        info: building.info,
        statusLabel: `${building.status} · level ${building.level}`,
        summaryLabel: `${building.actions.filter((action) => action.enabled).length}/${building.actions.length} actions ready`,
        stats: building.stats.map((stat) => ({
          label: stat.label,
          value: stat.value
        })),
        specialActions: building.specialActions.map((action) => {
          const cooldown = createCooldownCountdown(action.cooldownRemainingTicks, tickRateMs, nowMs);
          return {
            actionId: action.actionId,
            label: action.label,
            description: action.description,
            effectSummary: action.effectSummary,
            durationLabel: action.durationMs > 0 ? formatDurationMs(action.durationMs) : "Instant",
            cooldownLabel: cooldown.remainingMs > 0 ? `Cooldown ${formatDurationMs(cooldown.remainingMs)}` : formatDurationMs(action.cooldownMs),
            cooldownRemainingMs: cooldown.remainingMs,
            cooldownEndsAtMs: cooldown.endsAtMs,
            heatLabel: `+${action.heatGain}`,
            disabled: hasPendingCommand || !action.enabled,
            disabledReason: hasPendingCommand ? "Command pending." : action.disabledReason
          };
        }),
        actions: building.actions.map((action) => {
          const cooldown = createCooldownCountdown(action.cooldownRemainingTicks, tickRateMs, nowMs);
          return {
            actionId: action.actionId,
            label: action.label,
            description: action.description,
            inputSummary: formatResourceSummary(action.inputCost, "Free"),
            outputSummary: formatResourceSummary(action.outputGain, "No output"),
            cooldownLabel: cooldown.remainingMs > 0 ? `Cooldown ${formatDurationMs(cooldown.remainingMs)}` : `${Math.ceil(action.cooldownMs / 1e3)}s cooldown`,
            cooldownRemainingMs: cooldown.remainingMs,
            cooldownEndsAtMs: cooldown.endsAtMs,
            heatLabel: `+${action.heatGain}`,
            influenceLabel: formatSigned$1(action.influenceChange),
            disabled: hasPendingCommand || !action.enabled,
            disabledReason: hasPendingCommand ? "Command pending." : action.disabledReason
          };
        })
      })),
      slots: slice.district.slots.map((slot) => ({
        slotIndex: slot.slotIndex,
        buildingTypeId: slot.buildingTypeId,
        title: slot.buildingTypeId ? toTitleCase$3(slot.buildingTypeId) : `Empty slot ${slot.slotIndex + 1}`,
        statusLabel: slot.status,
        canBuild: false,
        summaryLabel: slot.processing ? `${slot.processing.label} is processing on the server tick.` : slot.production && slot.craftOptions.length > 0 ? `${slot.production.resourceLabel} production runs on the server tick and collected stock can be processed here.` : slot.production ? `${slot.production.resourceLabel} production is running on the server tick.` : slot.craftOptions.length > 0 ? "This structure processes collected stock through server-authoritative recipes." : slot.buildingTypeId ? "Structure already placed" : "No fixed building is assigned to this district slot.",
        production: slot.production && slot.buildingId ? {
          buildingId: slot.buildingId,
          resourceLabel: slot.production.resourceLabel,
          storageLabel: `${slot.production.storedAmount}/${slot.production.storageCap} ready`,
          storagePercent: getStoragePercent(slot.production.storedAmount, slot.production.storageCap),
          playerStockLabel: `${Math.max(0, Number(playerResources[slot.production.resourceKey] || 0))} in stock`,
          rateLabel: `${slot.production.amountPerTick}/tick`,
          canCollect: slot.production.canCollect && !hasPendingCommand,
          collectDisabledReason: hasPendingCommand ? "Command pending." : slot.production.collectDisabledReason
        } : null,
        processing: slot.processing ? {
          label: slot.processing.label,
          progressLabel: `${Math.max(0, slot.processing.totalTicks - slot.processing.remainingTicks)}/${slot.processing.totalTicks} ticks`,
          completionLabel: `Ready in ${formatTickLabel(slot.processing.remainingTicks)}`,
          outputLabel: `+${slot.processing.outputAmount} ${slot.processing.outputResourceLabel}`
        } : null,
        craftOptions: slot.craftOptions.map((option) => ({
          buildingId: slot.buildingId ?? "",
          recipeId: option.recipeId,
          label: option.label,
          inputSummary: option.inputSummary,
          outputAmount: option.outputAmount,
          outputResourceLabel: option.outputResourceLabel,
          playerStockLabel: `${Math.max(0, Number(playerResources[option.outputResourceKey] || 0))} ${option.outputResourceLabel} in stock`,
          canCraft: option.canCraft && !hasPendingCommand && Boolean(slot.buildingId),
          disabledReason: hasPendingCommand ? "Command pending." : option.craftDisabledReason
        })),
        buildOptions: []
      }))
    };
  };
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
  const formatResourceSummary = (values, emptyLabel) => {
    const parts = Object.entries(values).filter(([, amount]) => amount > 0);
    return parts.length > 0 ? parts.map(([resourceKey, amount]) => `${amount} ${toTitleCase$3(resourceKey)}`).join(" + ") : emptyLabel;
  };
  const formatSigned$1 = (value) => value >= 0 ? `+${value}` : String(value);
  const createMapDistrictViewModels = (districts, selectedDistrictId, attackTargets = []) => districts.map((district) => {
    const attackTarget = attackTargets.find((target) => target.districtId === district.districtId);
    const isDestroyed = district.status === "destroyed";
    return {
      districtId: district.districtId,
      label: district.name,
      ownerLabel: isDestroyed ? "Destroyed district" : district.isOwnedByPlayer ? "Owned by current player" : district.ownerPlayerId ? `Owned by ${district.ownerPlayerId}` : "Neutral district",
      zoneLabel: toTitleCase$2(district.zone),
      heatLabel: String(district.heat),
      influenceLabel: String(district.influence),
      buildingSummary: `${district.filledSlotCount} fixed`,
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
  const createPlayerViewModel = (view, modeLabelOverride) => view ? {
    playerId: view.playerId,
    instanceId: view.instanceId,
    modeLabel: modeLabelOverride ?? view.mode,
    resourceSummary: formatResourceBalances(view.resourceBalances),
    notificationCount: view.notifications.length
  } : null;
  const formatResourceBalances = (balances) => {
    const parts = Object.entries(balances).filter(([, amount]) => amount > 0);
    return parts.length > 0 ? parts.map(([resourceKey, amount]) => `${toTitleCase$1(resourceKey)} ${amount}`).join(" · ") : "No resources";
  };
  const toTitleCase$1 = (value) => value.split("-").filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
  const createReportViewModels = (reports) => reports.map((report) => ({
    id: report.reportId,
    title: report.reportType === "spy" ? `Spy ${report.result} on ${report.targetDistrictId}` : report.reportType === "building-action" ? `${toTitleCase(report.buildingActionId)} on ${report.districtId}` : report.districtDestroyed ? `District catastrophe on ${report.targetDistrictId}` : `Attack ${report.result} on ${report.targetDistrictId}`,
    createdAt: `${report.tick}`,
    category: report.reportType,
    summary: report.reportType === "spy" ? report.trapDetected ? "Defense confirmed. Trap detected." : "Defense scout resolved." : report.reportType === "building-action" ? formatBuildingActionSummary(report) : report.districtDestroyed ? "Catastrophe destroyed the district. Control, buildings, heat, and influence were wiped." : report.trapTriggered ? "Trap triggered during the attack." : report.districtCaptured ? "District captured." : "District held by defender.",
    result: report.result,
    severity: report.reportType === "battle" && report.districtDestroyed ? "critical" : "normal",
    messages: report.reportType === "building-action" ? report.messages ?? [] : report.reportType === "battle" && report.districtDestroyed ? [
      "District state: destroyed and unusable.",
      "Owner: none.",
      "Fixed buildings: lost.",
      "All primary district actions are disabled."
    ] : []
  }));
  const formatBuildingActionSummary = (report) => {
    const parts = [
      formatResourceDelta(report.outputGain),
      formatDefenseDelta(report.defenseAdded ?? {}),
      formatIntelDelta(report.intelRevealedDistrictIds ?? []),
      `Heat +${report.heatGain}`,
      `Influence ${formatSigned(report.influenceChange)}`
    ].filter(Boolean);
    return parts.join(" · ");
  };
  const formatResourceDelta = (values) => {
    const parts = Object.entries(values).filter(([, amount]) => amount > 0);
    return parts.length > 0 ? parts.map(([resourceKey, amount]) => `+${amount} ${toTitleCase(resourceKey)}`).join(", ") : "No resource output";
  };
  const formatDefenseDelta = (values) => {
    const parts = Object.entries(values).filter(([, amount]) => amount > 0);
    return parts.length > 0 ? `Defense ${parts.map(([resourceKey, amount]) => `+${amount} ${toTitleCase(resourceKey)}`).join(", ")}` : "";
  };
  const formatIntelDelta = (districtIds) => districtIds.length > 0 ? `Intel ${districtIds.length} district${districtIds.length === 1 ? "" : "s"}` : "";
  const formatSigned = (value) => value >= 0 ? `+${value}` : String(value);
  const toTitleCase = (value) => value.replaceAll("_", "-").split("-").filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
  const renderReportLayer = (reports) => reports.length > 0 ? [
    `<section class="reports-panel" data-feature="reports-panel">`,
    renderCatastropheAlert(reports),
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Reports</h3>`,
    `<p class="district-panel__section-copy">Latest server-authored spy and battle reports for the current player.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${reports.length} recent</span>`,
    `</div>`,
    reports.map(
      (report) => [
        `<article class="district-panel__slot" data-report-id="${report.id}" data-report-category="${report.category}" data-report-severity="${report.severity}">`,
        `<div class="district-panel__slot-head">`,
        `<div>`,
        `<p class="district-panel__slot-index">${report.category}</p>`,
        `<h4 class="district-panel__slot-title">${report.title}</h4>`,
        `</div>`,
        `<span class="district-panel__slot-state">${report.result}</span>`,
        `</div>`,
        `<p class="district-panel__slot-summary">${report.summary}</p>`,
        `<p class="district-panel__empty-copy">Tick ${report.createdAt}</p>`,
        `</article>`
      ].join("")
    ).join(""),
    `</section>`
  ].join("") : "";
  const renderCatastropheAlert = (reports) => {
    const catastropheReport = reports.find((report) => report.severity === "critical");
    if (!catastropheReport) {
      return "";
    }
    return [
      `<section class="reports-panel__catastrophe-window" data-catastrophe-alert="true" role="dialog" aria-label="District catastrophe report">`,
      `<div class="district-panel__section-head">`,
      `<div>`,
      `<h3 class="district-panel__section-title">${catastropheReport.title}</h3>`,
      `<p class="district-panel__section-copy">${catastropheReport.summary}</p>`,
      `</div>`,
      `<span class="district-panel__section-meta">${catastropheReport.result}</span>`,
      `</div>`,
      `<div class="district-panel__slot-list">`,
      catastropheReport.messages.map((message) => `<p class="district-panel__action-reason">${message}</p>`).join(""),
      `</div>`,
      `</section>`
    ].join("");
  };
  const renderSidePanelShell = ({ activePanel, contentHtml }) => activePanel ? `<aside class="side-panel-shell" data-panel="${activePanel}">${contentHtml}</aside>` : '<aside class="side-panel-shell" data-panel="none"></aside>';
  const renderTopBarShell = ({ player }) => player ? `<header data-mode="${player.modeLabel}">Mode: ${player.modeLabel} · Player: ${player.playerId} · Resources: ${player.resourceSummary} · Alerts: ${player.notificationCount}</header>` : '<header data-mode="unknown">Loading player projection...</header>';
  const renderClientShell = (store) => {
    var _a, _b, _c, _d, _e;
    const readModel = store.getReadModel();
    const uiState = store.getUiState();
    const player = createPlayerViewModel(
      readModel.playerView,
      (_a = readModel.gameplaySlice) == null ? void 0 : _a.mode.label
    );
    const mapDistricts = createMapDistrictViewModels(
      ((_b = readModel.gameplaySlice) == null ? void 0 : _b.districts) ?? [],
      uiState.selectedDistrictId,
      ((_d = (_c = readModel.gameplaySlice) == null ? void 0 : _c.district) == null ? void 0 : _d.attackTargets) ?? []
    );
    const districtPanel = createDistrictPanelViewModel(readModel.gameplaySlice, uiState);
    const reports = createReportViewModels(((_e = readModel.gameplaySlice) == null ? void 0 : _e.reports) ?? []);
    const sidePanelContent = [districtPanel ? renderDistrictPanel(districtPanel) : "", renderReportLayer(reports)].join("");
    return {
      topBarHtml: renderTopBarShell({
        player
      }),
      mapHtml: renderMap({
        districts: mapDistricts,
        selectedDistrictId: uiState.selectedDistrictId
      }),
      sidePanelHtml: renderSidePanelShell({
        activePanel: uiState.activeSidePanel,
        contentHtml: sidePanelContent
      }),
      player,
      mapDistricts,
      districtPanel,
      reports,
      errors: readModel.lastErrors,
      connection: readModel.connection
    };
  };
  const createClientApp = ({ transport }) => {
    const store = createClientStore(createInitialClientUiState());
    const dispatcher = createCommandDispatcher(transport);
    let renderState = createInitialClientRenderState();
    const commitResponse = (response, selectedDistrictId) => {
      var _a;
      if (response.readModel) {
        store.setGameplaySlice(response.readModel);
        store.patchUiState({
          selectedDistrictId,
          activeSidePanel: districtPanelFeature
        });
      }
      store.setErrors(response.errors);
      store.setConnectionState({
        status: "ready",
        lastErrorMessage: ((_a = response.errors[0]) == null ? void 0 : _a.message) ?? null,
        staleData: response.errors.length > 0
      });
      renderState = renderClientShell(store);
      return renderState;
    };
    const commitTransportFailure = (message) => {
      const errors = [
        {
          code: "client.transport_error",
          message
        }
      ];
      store.setErrors(errors);
      store.setConnectionState({
        status: "error",
        lastErrorMessage: message,
        staleData: true
      });
      renderState = renderClientShell(store);
      return renderState;
    };
    renderState = renderClientShell(store);
    const createLoadRequestForSelectedDistrict = (districtId) => {
      const playerView = store.getReadModel().playerView;
      if (!playerView) {
        return null;
      }
      return {
        serverInstanceId: playerView.instanceId,
        playerId: playerView.playerId,
        districtId
      };
    };
    return createClientAppShell({
      load: async (request) => {
        store.setConnectionState({
          status: "connecting",
          lastErrorMessage: null,
          staleData: false
        });
        try {
          const response = await transport.load(request);
          return commitResponse(response, request.districtId);
        } catch (_error) {
          return commitTransportFailure("Unable to load gameplay slice from server.");
        }
      },
      selectDistrict: async (districtId) => {
        const request = createLoadRequestForSelectedDistrict(districtId);
        if (!request) {
          return commitTransportFailure("Cannot select a district before the gameplay slice is loaded.");
        }
        store.setConnectionState({
          status: "connecting",
          lastErrorMessage: null,
          staleData: false
        });
        store.patchUiState({
          selectedBuildingId: null
        });
        renderState = renderClientShell(store);
        try {
          const response = await transport.load(request);
          return commitResponse(response, districtId);
        } catch (_error) {
          return commitTransportFailure("Unable to load selected district from server.");
        }
      },
      selectBuilding: async (buildingId) => {
        store.patchUiState({
          selectedBuildingId: buildingId
        });
        renderState = renderClientShell(store);
        return renderState;
      },
      dispatch: async (command) => {
        const uiState = store.getUiState();
        if (!uiState.selectedDistrictId) {
          return commitTransportFailure("No district is selected for the district panel slice.");
        }
        store.patchUiState({
          pendingCommandIds: [...uiState.pendingCommandIds, command.id]
        });
        renderState = renderClientShell(store);
        try {
          const response = await dispatcher.dispatch({
            command,
            focusDistrictId: uiState.selectedDistrictId
          });
          store.patchUiState({
            pendingCommandIds: store.getUiState().pendingCommandIds.filter((pendingCommandId) => pendingCommandId !== command.id)
          });
          return commitResponse(response, uiState.selectedDistrictId);
        } catch (_error) {
          store.patchUiState({
            pendingCommandIds: store.getUiState().pendingCommandIds.filter((pendingCommandId) => pendingCommandId !== command.id)
          });
          return commitTransportFailure("Unable to submit gameplay command to server.");
        }
      },
      getRenderState: () => renderState,
      getGameplaySlice: () => store.getReadModel().gameplaySlice
    });
  };
  const formatLiveCooldownDuration = (remainingMs) => {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1e3));
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) {
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };
  const formatLiveCooldownLabel = ({
    endsAtMs,
    nowMs,
    prefix = "Cooldown ",
    readyLabel = "Ready"
  }) => {
    const remainingMs = Math.max(0, endsAtMs - nowMs);
    return remainingMs > 0 ? `${prefix}${formatLiveCooldownDuration(remainingMs)}` : readyLabel;
  };
  const refreshLiveCooldownLabels = (root, nowMs = Date.now()) => {
    const nodes = root.querySelectorAll("[data-live-cooldown]");
    nodes.forEach((node) => {
      const endsAtMs = Number(node.dataset.cooldownEndsAtMs || 0);
      node.textContent = formatLiveCooldownLabel({
        endsAtMs,
        nowMs,
        prefix: node.dataset.cooldownPrefix ?? "Cooldown ",
        readyLabel: node.dataset.cooldownReadyLabel ?? "Ready"
      });
      node.dataset.cooldownState = endsAtMs > nowMs ? "cooling" : "ready";
    });
    return nodes.length;
  };
  const DEFAULT_SESSION_STORAGE_KEY = "empireStreets.session.v1";
  const resolveGameplaySliceBootstrapRequest = (dataset, storage) => {
    const explicit = createExplicitRequest(dataset);
    if (explicit) {
      return explicit;
    }
    const session = readLegacySession(storage, dataset.sessionStorageKey);
    const registration = session == null ? void 0 : session.registration;
    const serverId = normalizeToken(registration == null ? void 0 : registration.serverId);
    const districtId = normalizeDistrictId(registration == null ? void 0 : registration.startDistrictId);
    const playerId = normalizePlayerId((registration == null ? void 0 : registration.identity) || (registration == null ? void 0 : registration.gangName));
    if (!serverId || !districtId || !playerId) {
      return null;
    }
    return {
      serverInstanceId: `instance:${serverId}`,
      playerId,
      districtId
    };
  };
  const createExplicitRequest = (dataset) => {
    const serverInstanceId = normalizeToken(dataset.serverInstanceId);
    const playerId = normalizeToken(dataset.playerId);
    const districtId = normalizeDistrictId(dataset.districtId);
    return serverInstanceId && playerId && districtId ? {
      serverInstanceId,
      playerId,
      districtId
    } : null;
  };
  const readLegacySession = (storage, storageKey = DEFAULT_SESSION_STORAGE_KEY) => {
    if (!storage) {
      return null;
    }
    const raw = storage.getItem(storageKey || DEFAULT_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  };
  const normalizeToken = (value) => {
    const normalized = String(value ?? "").trim();
    return normalized.length > 0 ? normalized : null;
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
  const normalizePlayerId = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return null;
    }
    if (raw.startsWith("player:")) {
      return raw;
    }
    const slug = raw.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
    return slug ? `player:${slug}` : null;
  };
  const DEFAULT_ENDPOINT_BASE = "/api/gameplay-slice";
  const mountGameplaySlicePage = (options) => {
    const request = resolveGameplaySliceBootstrapRequest(options.root.dataset, getBrowserStorage());
    if (!request) {
      options.root.hidden = true;
      return null;
    }
    const endpointBase = options.root.dataset.gameplaySliceEndpointBase || DEFAULT_ENDPOINT_BASE;
    const client = createClientApp({
      transport: options.transport ?? createFetchClientTransport({ endpointBase })
    });
    const router = createClientSurfaceActionRouter({
      client,
      createCommandId: createBrowserCommandId
    });
    const mounts = resolveMounts(options.root);
    options.root.hidden = false;
    const render = (state) => {
      mounts.status.innerHTML = renderStatus(state);
      mounts.topBar.innerHTML = state.topBarHtml;
      mounts.map.innerHTML = state.mapHtml;
      mounts.panel.innerHTML = state.sidePanelHtml || '<p class="gameplay-slice-client__empty">No server district selected.</p>';
      refreshLiveCooldownLabels(options.root);
    };
    const handleClick = async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const nextState = await router.handleTarget(target);
      if (nextState) {
        event.preventDefault();
        event.stopPropagation();
        render(nextState);
      }
    };
    const cooldownTimerId = window.setInterval(() => refreshLiveCooldownLabels(options.root), 1e3);
    options.root.addEventListener("click", handleClick);
    void client.load(request).then(render).catch(() => {
      mounts.status.innerHTML = [
        "<strong>Server sync unavailable</strong>",
        "<span>The gameplay slice endpoint did not return a read model.</span>"
      ].join("");
    });
    return {
      destroy: () => {
        window.clearInterval(cooldownTimerId);
        options.root.removeEventListener("click", handleClick);
      }
    };
  };
  const resolveMounts = (root) => ({
    status: getOrCreateMount(root, "status"),
    topBar: getOrCreateMount(root, "topbar"),
    map: getOrCreateMount(root, "map"),
    panel: getOrCreateMount(root, "panel")
  });
  const getOrCreateMount = (root, role) => {
    const existing = root.querySelector(`[data-gameplay-slice-${role}]`);
    if (existing) {
      return existing;
    }
    const mount = document.createElement("div");
    mount.dataset[`gameplaySlice${role.charAt(0).toUpperCase()}${role.slice(1)}`] = "true";
    root.append(mount);
    return mount;
  };
  const renderStatus = (state) => {
    var _a;
    return [
      `<strong>${state.connection.status === "ready" ? "Server synced" : state.connection.status}</strong>`,
      state.districtPanel ? `<span>${state.districtPanel.title}</span>` : "<span>Waiting for district projection</span>",
      state.errors.length > 0 ? `<span class="gameplay-slice-client__error">${((_a = state.errors[0]) == null ? void 0 : _a.message) ?? "Unknown gameplay slice error"}</span>` : ""
    ].join("");
  };
  const createBrowserCommandId = (prefix) => `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  const createPageApi = () => ({
    mount: (options) => mountGameplaySlicePage(options),
    autoMount: () => Array.from(document.querySelectorAll("[data-gameplay-slice-client]")).map((root) => mountGameplaySlicePage({ root })).filter((mount) => mount !== null)
  });
  const getBrowserStorage = () => {
    try {
      return window.localStorage;
    } catch (_error) {
      return null;
    }
  };
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.EmpireGameplaySliceClient = createPageApi();
    window.EmpireGameplaySliceClient.autoMount();
  }
  exports.mountGameplaySlicePage = mountGameplaySlicePage;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
