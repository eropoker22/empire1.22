var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(function() {
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
      building.specialActions.length > 0 ? building.specialActions.map((action) => renderSpecialAction(building, action)).join("") : `<p class="district-panel__empty-copy">Tahle budova nemá v katalogu speciální akce.</p>`,
      `</div>`,
      `</section>`
    ].join("");
  };
  const renderSpecialAction = (building, action) => {
    const disabledAttribute = action.disabled ? " disabled" : "";
    const reasonAttribute = action.disabledReason ? ` data-disabled-reason="${action.disabledReason}"` : "";
    return [
      `<article class="district-building-popup__action${action.disabled ? " is-disabled" : ""}" data-special-action-id="${action.actionId}">`,
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
      `<button class="district-panel__action-button district-panel__action-button--craft" data-building-action-building-id="${building.buildingId}" data-building-action-id="${action.actionId}"${disabledAttribute}${reasonAttribute}>Run</button>`,
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
  const createInMemoryClientTransport = (endpoint) => ({
    load: async (request) => endpoint.load(request),
    send: async (request) => endpoint.submit(request)
  });
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
          completionLabel: `Ready in ${formatTickLabel$2(slot.processing.remainingTicks)}`,
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
  const formatTickLabel$2 = (tickCount) => `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;
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
  const getInstanceHealth = (runtime) => {
    const warnings = [];
    if (runtime.record.status === "crashed") {
      warnings.push("Instance is crashed.");
    }
    if (runtime.scheduler.tickInProgress) {
      warnings.push("Tick is currently in progress.");
    }
    if (runtime.eventQueue.size() > 1e3) {
      warnings.push("Event queue is unusually large.");
    }
    if (runtime.record.crashCount > 0) {
      warnings.push("Instance has recorded crashes.");
    }
    if (runtime.record.status === "crashed") {
      return {
        status: "unhealthy",
        warnings,
        lastErrorAt: runtime.runtimeHealth.lastErrorAt
      };
    }
    if (warnings.length > 0) {
      return {
        status: "degraded",
        warnings,
        lastErrorAt: runtime.runtimeHealth.lastErrorAt
      };
    }
    return {
      status: "healthy",
      warnings,
      lastErrorAt: runtime.runtimeHealth.lastErrorAt
    };
  };
  const createInstanceMonitorSnapshot = (record, state, eventQueue, runtimeHealth) => ({
    instanceId: record.id,
    mode: record.mode,
    status: record.status,
    tick: state.root.tick,
    queuedEventCount: eventQueue.size(),
    playerCount: state.root.playerIds.length,
    crashCount: record.crashCount,
    lastErrorAt: runtimeHealth.lastErrorAt,
    lastTickCompletedAt: runtimeHealth.lastTickCompletedAt
  });
  const createEvent = (type, payload) => ({
    type,
    payload,
    occurredAt: (/* @__PURE__ */ new Date(0)).toISOString()
  });
  const createNotification = (input) => input;
  const CORE_EVENT_TYPES = {
    districtSpied: "district-spied",
    districtAttacked: "district-attacked",
    districtCaptured: "district-captured",
    trapPlaced: "trap-placed",
    trapTriggered: "trap-triggered",
    buildingActionResolved: "building-action-resolved",
    buildingPlaced: "building-placed",
    productionCollected: "production-collected",
    itemProcessingStarted: "item-processing-started",
    itemCrafted: "item-crafted",
    notificationCreated: "notification-created"
  };
  const PRODUCTION_GAME_LIFECYCLE_PHASES = {
    bootstrapping: "bootstrapping",
    live: "live"
  };
  const DEV_SETUP_GAME_LIFECYCLE_PHASES = {
    devSetup: "dev-setup"
  };
  const isDevSetupGameLifecyclePhase = (phase) => phase === DEV_SETUP_GAME_LIFECYCLE_PHASES.devSetup;
  const PLAYER_COLOR_OPTIONS = [
    { name: "Červená", value: "#ef4444" },
    { name: "Modrá", value: "#3b82f6" },
    { name: "Zelená", value: "#22c55e" },
    { name: "Žlutá", value: "#eab308" },
    { name: "Oranžová", value: "#f97316" },
    { name: "Fialová", value: "#8b5cf6" },
    { name: "Růžová", value: "#ec4899" },
    { name: "Tyrkysová", value: "#14b8a6" },
    { name: "Azurová", value: "#06b6d4" },
    { name: "Purpurová", value: "#a21caf" },
    { name: "Vínová", value: "#7f1d1d" },
    { name: "Olivová", value: "#6b8e23" },
    { name: "Limetková", value: "#84cc16" },
    { name: "Mentolová", value: "#a7f3d0" },
    { name: "Lososová", value: "#fa8072" },
    { name: "Korálová", value: "#ff7f50" },
    { name: "Zlatá", value: "#ffd700" },
    { name: "Stříbrná", value: "#c0c0c0" },
    { name: "Béžová", value: "#f5f5dc" },
    { name: "Hnědá", value: "#8b4513" },
    { name: "Černá", value: "#111111" },
    { name: "Bílá", value: "#ffffff" },
    { name: "Šedá", value: "#9ca3af" },
    { name: "Indigo", value: "#4f46e5" },
    { name: "Safírová", value: "#0f52ba" },
    { name: "Smaragdová", value: "#50c878" },
    { name: "Karmínová", value: "#dc143c" },
    { name: "Levandulová", value: "#e6e6fa" },
    { name: "Broskvová", value: "#ffdab9" },
    { name: "Antracitová", value: "#36454f" }
  ];
  const DEFAULT_PLAYER_COLOR = PLAYER_COLOR_OPTIONS[0].value;
  const ATTACK_WEAPON_IDS = [
    "baseball-bat",
    "pistol",
    "grenade",
    "smg",
    "bazooka"
  ];
  const ATTACK_POWER_BY_WEAPON = {
    "baseball-bat": 5,
    pistol: 10,
    grenade: 14,
    smg: 18,
    bazooka: 30
  };
  const DEFENSE_POWER_BY_WEAPON = {
    vest: 6,
    barricades: 12,
    cameras: 6,
    "defense-tower": 20,
    alarm: 10
  };
  const calculateBaseAttackPower = (loadout) => Object.entries(loadout).reduce((totalPower, [weaponId, amount]) => {
    const normalizedAmount = Math.max(0, amount ?? 0);
    const attackPower = ATTACK_POWER_BY_WEAPON[weaponId] ?? 0;
    return totalPower + normalizedAmount * attackPower;
  }, 0);
  const hasFullAttackWeaponSet = (loadout) => ATTACK_WEAPON_IDS.every((weaponId) => (loadout[weaponId] ?? 0) > 0);
  const calculateSmgComboBonus = (loadout) => {
    if (!hasFullAttackWeaponSet(loadout)) {
      return 0;
    }
    return (loadout.smg ?? 0) * 0.2;
  };
  const calculateGrenadeDefenseIgnorePercent = (grenadeCount) => Math.max(0, grenadeCount) * 0.3;
  const calculateBazookaTotalDestructionBonusPercent = (bazookaCount) => Math.max(0, bazookaCount) * 0.5;
  const calculateEffectiveDefenseAfterGrenades = (defensePercent, grenadeCount) => Math.max(0, defensePercent - calculateGrenadeDefenseIgnorePercent(grenadeCount));
  const calculateTotalAttackPower = (loadout) => calculateBaseAttackPower(loadout) + calculateSmgComboBonus(loadout);
  const calculateBaseDefensePower = (loadout) => Object.entries(loadout).reduce((totalPower, [weaponId, amount]) => {
    const normalizedAmount = Math.max(0, amount ?? 0);
    const defensePower = DEFENSE_POWER_BY_WEAPON[weaponId] ?? 0;
    return totalPower + normalizedAmount * defensePower;
  }, 0);
  const hasSpyDetectionChance = (cameraCount) => cameraCount >= 5;
  const calculateTowerAttackReductionPercent = (towerCount) => Math.max(0, towerCount) * 0.3;
  const calculateReducedAttackPowerFromTowers = (attackPower, towerCount) => {
    const reductionPercent = calculateTowerAttackReductionPercent(towerCount);
    return Math.max(0, attackPower * (1 - reductionPercent / 100));
  };
  const composeEntityId = (prefix, value) => `${prefix}:${value}`;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const deterministicUnitInterval = (seed) => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  };
  const completeProduction = (state, context) => {
    const productionBuildings = context.config.balance.productionBuildings;
    if (!productionBuildings || Object.keys(productionBuildings).length <= 0) {
      return state;
    }
    let nextResourceStates = state.resourceStatesById;
    let changed = false;
    for (const building of Object.values(state.buildingsById)) {
      const profile = productionBuildings[building.buildingTypeId];
      if (!profile || building.status !== "active") {
        continue;
      }
      const resourceStateId = composeEntityId("resource", building.id);
      const currentState = state.resourceStatesById[resourceStateId] ?? {
        id: resourceStateId,
        ownerType: "building",
        ownerId: building.id,
        balances: {
          [profile.resourceKey]: 0
        },
        incomeModifiers: {},
        lastUpdatedTick: Math.max(0, state.root.tick - 1),
        version: 0
      };
      const elapsedTicks = Math.max(0, state.root.tick - currentState.lastUpdatedTick);
      if (elapsedTicks <= 0) {
        continue;
      }
      const producedPerTick = Math.max(
        0,
        Math.floor(profile.amountPerTick * context.config.balance.productionMultiplier)
      );
      const currentAmount = Math.max(0, Number(currentState.balances[profile.resourceKey] || 0));
      const nextAmount = Math.min(profile.storageCap, currentAmount + producedPerTick * elapsedTicks);
      nextResourceStates = {
        ...nextResourceStates,
        [resourceStateId]: {
          ...currentState,
          balances: {
            ...currentState.balances,
            [profile.resourceKey]: nextAmount
          },
          lastUpdatedTick: state.root.tick,
          version: currentState.version + 1
        }
      };
      changed = true;
    }
    return changed ? {
      ...state,
      resourceStatesById: nextResourceStates
    } : state;
  };
  const completeCraftProcessing = (state, context) => {
    var _a, _b;
    let nextBuildingsById = state.buildingsById;
    let nextResourceStates = state.resourceStatesById;
    let nextNotificationsById = state.notificationsById;
    let nextNotificationIds = state.root.notificationIds;
    const events = [];
    let changed = false;
    for (const building of Object.values(state.buildingsById)) {
      const processingJob = building.processing;
      if (!processingJob || building.status !== "active" || processingJob.completesAtTick > state.root.tick) {
        continue;
      }
      const player = state.playersById[building.ownerPlayerId];
      const recipe = (_b = (_a = context.config.balance.craftBuildings) == null ? void 0 : _a[building.buildingTypeId]) == null ? void 0 : _b.recipes[processingJob.recipeId];
      if (!player || !recipe) {
        continue;
      }
      const currentPlayerResourceState = nextResourceStates[player.resourceStateId] ?? createPlayerResourceState$3(player, state.root.tick);
      const nextPlayerResourceState = {
        ...currentPlayerResourceState,
        balances: {
          ...currentPlayerResourceState.balances,
          [recipe.outputResourceKey]: Math.max(
            0,
            Number(currentPlayerResourceState.balances[recipe.outputResourceKey] || 0) + recipe.outputAmount
          )
        },
        lastUpdatedTick: state.root.tick,
        version: currentPlayerResourceState.version + (nextResourceStates[player.resourceStateId] ? 1 : 0)
      };
      nextResourceStates = {
        ...nextResourceStates,
        [nextPlayerResourceState.id]: nextPlayerResourceState
      };
      nextBuildingsById = {
        ...nextBuildingsById,
        [building.id]: {
          ...building,
          processing: null,
          version: building.version + 1
        }
      };
      const notification = createProcessingCompletedNotification(
        state.serverInstance.id,
        building.id,
        player.id,
        recipe.label,
        recipe.outputResourceLabel,
        recipe.outputAmount,
        state.root.tick
      );
      nextNotificationsById = {
        ...nextNotificationsById,
        [notification.id]: notification
      };
      nextNotificationIds = [...nextNotificationIds, notification.id];
      events.push(
        createEvent(CORE_EVENT_TYPES.itemCrafted, {
          playerId: building.ownerPlayerId,
          districtId: building.districtId,
          buildingId: building.id,
          recipeId: processingJob.recipeId,
          outputResourceKey: recipe.outputResourceKey,
          outputAmount: recipe.outputAmount
        }),
        createEvent(CORE_EVENT_TYPES.notificationCreated, {
          notificationId: notification.id,
          recipientId: player.id,
          category: notification.category
        })
      );
      changed = true;
    }
    return changed ? {
      nextState: {
        ...state,
        buildingsById: nextBuildingsById,
        resourceStatesById: nextResourceStates,
        notificationsById: nextNotificationsById,
        root: {
          ...state.root,
          notificationIds: nextNotificationIds,
          version: state.root.version + 1
        }
      },
      events
    } : {
      nextState: state,
      events
    };
  };
  const createPlayerResourceState$3 = (player, tick) => ({
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: player.id,
    balances: {},
    incomeModifiers: {},
    lastUpdatedTick: tick,
    version: 1
  });
  const createProcessingCompletedNotification = (instanceId, buildingId, playerId, recipeLabel, outputResourceLabel, outputAmount, tick) => createNotification({
    id: composeEntityId("notification", `${buildingId}:crafted:${tick}`),
    recipientType: "player",
    recipientId: playerId,
    category: "processing.completed",
    title: `${recipeLabel} ready`,
    bodyKey: "processing.completed",
    payload: {
      instanceId,
      buildingId,
      recipeLabel,
      outputResourceLabel,
      outputAmount,
      tick
    },
    createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    readAt: null
  });
  const resolveCraftProcessingDurationTicks = (durationTicks, cooldownMultiplier) => Math.max(1, Math.ceil(durationTicks * cooldownMultiplier));
  const resolveSpy = (input) => {
    const cameraCount = input.defenseLoadout.cameras ?? 0;
    const alarmCount = input.defenseLoadout.alarm ?? 0;
    const cameraPenalty = hasSpyDetectionChance(cameraCount) ? 0.18 : 0;
    const alarmPenalty = alarmCount >= 5 ? 0.08 : 0;
    const successChance = clamp(input.spyBaseSuccessChance - cameraPenalty - alarmPenalty, 0.08, 0.95);
    const successRoll = deterministicUnitInterval(
      `${input.worldSeed}:spy:success:${input.playerId}:${input.targetDistrictId}:${input.tick}`
    );
    const result = successRoll <= successChance ? "success" : "failure";
    const trapRevealRoll = deterministicUnitInterval(
      `${input.worldSeed}:spy:trap:${input.playerId}:${input.targetDistrictId}:${input.tick}`
    );
    const trapDetected = result === "success" && input.hasActiveTrap && trapRevealRoll <= input.spyTrapRevealChance;
    return {
      result,
      detectedDefense: result === "success" ? filterDefenseLoadout$1(input.defenseLoadout) : {},
      trapDetected
    };
  };
  const filterDefenseLoadout$1 = (loadout) => Object.fromEntries(
    Object.entries(loadout).filter(([, amount]) => Math.max(0, Number(amount ?? 0)) > 0)
  );
  const LOSS_ORDER = [
    "baseball-bat",
    "pistol",
    "smg",
    "grenade",
    "bazooka"
  ];
  const resolveTrap = (input) => {
    let remainingLosses = Math.max(0, input.trapAttackLosses);
    const nextLoadout = { ...input.attackLoadout };
    const losses = {};
    for (const weaponId of LOSS_ORDER) {
      while (remainingLosses > 0 && Math.max(0, Number(nextLoadout[weaponId] ?? 0)) > 0) {
        nextLoadout[weaponId] = Math.max(0, Number(nextLoadout[weaponId] ?? 0) - 1);
        losses[weaponId] = Math.max(0, Number(losses[weaponId] ?? 0) + 1);
        remainingLosses -= 1;
      }
    }
    return {
      losses,
      nextLoadout,
      blocked: LOSS_ORDER.every((weaponId) => Math.max(0, Number(nextLoadout[weaponId] ?? 0)) === 0)
    };
  };
  const validateAttack = (state, command) => {
    var _a, _b;
    const attacker = state.playersById[command.playerId];
    const sourceDistrict = command.payload.sourceDistrictId ? state.districtsById[command.payload.sourceDistrictId] : null;
    const targetDistrict = state.districtsById[command.payload.districtId];
    if (!attacker) {
      return [
        {
          code: "attacker_not_found",
          message: `Attacking player ${command.playerId} was not found.`
        }
      ];
    }
    if (!targetDistrict) {
      return [
        {
          code: "district_not_found",
          message: `Target district ${command.payload.districtId} was not found.`
        }
      ];
    }
    if (!sourceDistrict) {
      return [
        {
          code: "source_district_not_found",
          message: "Player must attack from one owned neighboring district."
        }
      ];
    }
    if (sourceDistrict.status === "destroyed") {
      return [
        {
          code: "source_district_destroyed",
          message: "Player cannot attack from a destroyed district."
        }
      ];
    }
    if (targetDistrict.status === "destroyed") {
      return [
        {
          code: "target_district_destroyed",
          message: "Destroyed districts cannot be attacked."
        }
      ];
    }
    if (sourceDistrict.ownerPlayerId !== command.playerId) {
      return [
        {
          code: "source_district_not_owned",
          message: "Player can only attack from a district they own."
        }
      ];
    }
    if (targetDistrict.ownerPlayerId === command.playerId) {
      return [
        {
          code: "attack_own_district",
          message: "Player cannot attack a district they already own."
        }
      ];
    }
    if (!sourceDistrict.adjacentDistrictIds.includes(targetDistrict.id)) {
      return [
        {
          code: "target_not_adjacent",
          message: "Player can only attack a district that borders the selected source district."
        }
      ];
    }
    if (calculateTotalAttackPower(attacker.attackLoadout) <= 0) {
      return [
        {
          code: "no_attack_weapons",
          message: "Player has no attack weapons available for this attack."
        }
      ];
    }
    const attackCooldownKey = `attack:${targetDistrict.id}`;
    const activeAttackCooldownTick = (_b = (_a = state.cooldownStatesById[attacker.cooldownStateId]) == null ? void 0 : _a.cooldowns) == null ? void 0 : _b[attackCooldownKey];
    if (typeof activeAttackCooldownTick === "number" && activeAttackCooldownTick > state.root.tick) {
      return [
        {
          code: "attack_cooldown_active",
          message: `Attack route to ${targetDistrict.name} is cooling down for ${activeAttackCooldownTick - state.root.tick} more ticks.`
        }
      ];
    }
    return [];
  };
  const validateBuildStructure = (state, command, context) => {
    const district = state.districtsById[command.payload.districtId];
    if (!district) {
      return [
        {
          code: "district_not_found",
          message: "Target district does not exist."
        }
      ];
    }
    if (district.ownerPlayerId !== command.playerId) {
      return [
        {
          code: "district_not_owned",
          message: "Player does not own the target district."
        }
      ];
    }
    if (command.payload.slotIndex < 0 || command.payload.slotIndex >= district.slotCount) {
      return [
        {
          code: "invalid_slot_index",
          message: "Requested build slot is outside the district capacity."
        }
      ];
    }
    if (district.buildingIds.length >= district.slotCount) {
      return [
        {
          code: "district_full",
          message: "No free building slot remains in the target district."
        }
      ];
    }
    if (district.slotCount > context.config.balance.buildSlotLimit) {
      return [
        {
          code: "district_slot_limit_exceeds_mode_cap",
          message: "District slot count exceeds the resolved mode configuration."
        }
      ];
    }
    return [];
  };
  const validateCollect = (state, command, context) => {
    var _a, _b;
    const building = state.buildingsById[command.payload.buildingId];
    if (!building) {
      return [
        {
          code: "building_not_found",
          message: "Target production building does not exist."
        }
      ];
    }
    const district = state.districtsById[command.payload.districtId];
    if (!district || building.districtId !== district.id) {
      return [
        {
          code: "district_not_found",
          message: "Target district for collection does not exist."
        }
      ];
    }
    if (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId) {
      return [
        {
          code: "production_not_owned",
          message: "Player does not own the target production building."
        }
      ];
    }
    if (building.status !== "active") {
      return [
        {
          code: "building_not_active",
          message: "Only active production buildings can be collected."
        }
      ];
    }
    const productionProfile = (_a = context.config.balance.productionBuildings) == null ? void 0 : _a[building.buildingTypeId];
    if (!productionProfile) {
      return [
        {
          code: "production_not_supported",
          message: "The target building does not support migrated production collection."
        }
      ];
    }
    const resourceState = state.resourceStatesById[composeEntityId("resource", building.id)];
    const readyAmount = Math.max(0, Number(((_b = resourceState == null ? void 0 : resourceState.balances) == null ? void 0 : _b[productionProfile.resourceKey]) || 0));
    if (readyAmount <= 0) {
      return [
        {
          code: "production_empty",
          message: `No ${productionProfile.resourceLabel} is ready to collect.`
        }
      ];
    }
    return [];
  };
  const validateCraft = (state, command, context) => {
    var _a, _b;
    const building = state.buildingsById[command.payload.buildingId];
    if (!building) {
      return [
        {
          code: "building_not_found",
          message: "Target crafting building does not exist."
        }
      ];
    }
    const district = state.districtsById[command.payload.districtId];
    if (!district || building.districtId !== district.id) {
      return [
        {
          code: "district_not_found",
          message: "Target district for crafting does not exist."
        }
      ];
    }
    if (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId) {
      return [
        {
          code: "craft_not_owned",
          message: "Player does not own the target crafting building."
        }
      ];
    }
    if (building.status !== "active") {
      return [
        {
          code: "building_not_active",
          message: "Only active buildings can process items."
        }
      ];
    }
    const craftProfile = (_a = context.config.balance.craftBuildings) == null ? void 0 : _a[building.buildingTypeId];
    if (!craftProfile) {
      return [
        {
          code: "craft_not_supported",
          message: "The target building does not support migrated crafting yet."
        }
      ];
    }
    const recipe = craftProfile.recipes[command.payload.recipeId];
    if (!recipe) {
      return [
        {
          code: "craft_recipe_not_found",
          message: "Requested crafting recipe does not exist for this building."
        }
      ];
    }
    if (building.processing) {
      const activeRecipe = craftProfile.recipes[building.processing.recipeId];
      return [
        {
          code: "craft_processing_active",
          message: activeRecipe ? `${activeRecipe.label} is already processing in this building.` : "Another processing job is already running in this building."
        }
      ];
    }
    const player = state.playersById[command.playerId];
    const balances = player ? ((_b = state.resourceStatesById[player.resourceStateId]) == null ? void 0 : _b.balances) ?? {} : {};
    for (const [resourceKey, requiredAmount] of Object.entries(recipe.inputCosts)) {
      const availableAmount = Math.max(0, Number(balances[resourceKey] || 0));
      if (availableAmount < requiredAmount) {
        return [
          {
            code: "craft_missing_inputs",
            message: `Need ${requiredAmount} ${formatResourceLabel$2(resourceKey)} to process ${recipe.label}.`
          }
        ];
      }
    }
    return [];
  };
  const formatResourceLabel$2 = (resourceKey) => resourceKey.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
  const validatePlaceTrap = (state, command) => {
    const player = state.playersById[command.playerId];
    const district = state.districtsById[command.payload.districtId];
    if (!player) {
      return [
        {
          code: "trap_player_not_found",
          message: `Player ${command.playerId} was not found.`
        }
      ];
    }
    if (!district) {
      return [
        {
          code: "trap_district_not_found",
          message: `Target district ${command.payload.districtId} was not found.`
        }
      ];
    }
    if (district.status === "destroyed") {
      return [
        {
          code: "trap_district_destroyed",
          message: "Destroyed districts cannot be trapped."
        }
      ];
    }
    if (district.ownerPlayerId !== command.playerId) {
      return [
        {
          code: "trap_not_owned",
          message: "Player can only arm a trap on a district they own."
        }
      ];
    }
    const activeTrap = Object.values(state.trapsById).find(
      (trap) => trap.ownerPlayerId === command.playerId && trap.status === "active"
    );
    if ((activeTrap == null ? void 0 : activeTrap.districtId) === district.id) {
      return [
        {
          code: "trap_already_active",
          message: `A trap is already armed on ${district.name}.`
        }
      ];
    }
    if (activeTrap) {
      return [
        {
          code: "trap_limit_reached",
          message: "Player can only keep one active trap armed at a time."
        }
      ];
    }
    return [];
  };
  const validateRunBuildingAction = (state, command, context) => {
    var _a, _b;
    const player = state.playersById[command.playerId];
    const district = state.districtsById[command.payload.districtId];
    const building = state.buildingsById[command.payload.buildingId];
    const action = (_a = context.config.balance.buildingActions) == null ? void 0 : _a[command.payload.actionId];
    const errors = [];
    if (!player) {
      errors.push({
        code: "player_not_found",
        message: `Player ${command.playerId} was not found.`
      });
    }
    if (!district) {
      errors.push({
        code: "district_not_found",
        message: `District ${command.payload.districtId} was not found.`
      });
    }
    if (!building) {
      errors.push({
        code: "building_not_found",
        message: `Building ${command.payload.buildingId} was not found.`
      });
    }
    if (!action) {
      errors.push({
        code: "building_action_not_found",
        message: `Building action ${command.payload.actionId} is not configured.`
      });
    }
    if (errors.length > 0 || !player || !district || !building || !action) {
      return errors;
    }
    if (!district.buildingIds.includes(building.id) || building.districtId !== district.id) {
      errors.push({
        code: "building_not_in_district",
        message: "Target building is not fixed in the selected district."
      });
    }
    if (district.status === "destroyed") {
      errors.push({
        code: "district_destroyed",
        message: "Destroyed districts cannot run fixed-building actions."
      });
    }
    if (action.buildingType !== building.buildingTypeId) {
      errors.push({
        code: "building_action_type_mismatch",
        message: `Action ${action.actionId} cannot run on ${building.buildingTypeId}.`
      });
    }
    if (action.requiredOwner && (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId)) {
      errors.push({
        code: "building_action_owner_required",
        message: "Player must own the district and fixed building to run this action."
      });
    }
    if (district.status === "contested" && !action.allowedIfContested) {
      errors.push({
        code: "building_action_contested",
        message: "This building action cannot run while the district is contested."
      });
    }
    if (building.status !== "active") {
      errors.push({
        code: "building_not_active",
        message: "Only active fixed buildings can run actions."
      });
    }
    const cooldownUntilTick = Number((building.actionCooldowns ?? {})[action.actionId] ?? 0);
    if (cooldownUntilTick > state.root.tick) {
      errors.push({
        code: "building_action_cooldown",
        message: `Building action is cooling down for ${cooldownUntilTick - state.root.tick} more ticks.`
      });
    }
    const balances = ((_b = state.resourceStatesById[player.resourceStateId]) == null ? void 0 : _b.balances) ?? {};
    const missingCosts = Object.entries(action.inputCost).filter(
      ([resourceKey, requiredAmount]) => Math.max(0, Number(balances[resourceKey] || 0)) < requiredAmount
    );
    if (missingCosts.length > 0) {
      errors.push({
        code: "building_action_insufficient_resources",
        message: `Missing resources: ${missingCosts.map(([key, amount]) => `${amount} ${key}`).join(", ")}.`
      });
    }
    return errors;
  };
  const validateSpy = (state, command) => {
    var _a, _b;
    const player = state.playersById[command.playerId];
    const sourceDistrict = state.districtsById[command.payload.sourceDistrictId];
    const targetDistrict = state.districtsById[command.payload.districtId];
    if (!player) {
      return [
        {
          code: "spy_player_not_found",
          message: `Player ${command.playerId} was not found.`
        }
      ];
    }
    if (!targetDistrict) {
      return [
        {
          code: "spy_target_not_found",
          message: `Target district ${command.payload.districtId} was not found.`
        }
      ];
    }
    if (!sourceDistrict) {
      return [
        {
          code: "spy_source_not_found",
          message: "Player must spy from one owned neighboring district."
        }
      ];
    }
    if (sourceDistrict.status === "destroyed") {
      return [
        {
          code: "spy_source_destroyed",
          message: "Player cannot spy from a destroyed district."
        }
      ];
    }
    if (targetDistrict.status === "destroyed") {
      return [
        {
          code: "spy_target_destroyed",
          message: "Destroyed districts cannot be spied on."
        }
      ];
    }
    if (sourceDistrict.ownerPlayerId !== command.playerId) {
      return [
        {
          code: "spy_source_not_owned",
          message: "Player can only spy from a district they own."
        }
      ];
    }
    if (targetDistrict.ownerPlayerId === command.playerId) {
      return [
        {
          code: "spy_own_district",
          message: "Player cannot spy on a district they already own."
        }
      ];
    }
    if (!sourceDistrict.adjacentDistrictIds.includes(targetDistrict.id)) {
      return [
        {
          code: "spy_target_not_adjacent",
          message: "Player can only spy on a district that borders the selected source district."
        }
      ];
    }
    const spyCooldownKey = `spy:${targetDistrict.id}`;
    const activeSpyCooldownTick = (_b = (_a = state.cooldownStatesById[player.cooldownStateId]) == null ? void 0 : _a.cooldowns) == null ? void 0 : _b[spyCooldownKey];
    if (typeof activeSpyCooldownTick === "number" && activeSpyCooldownTick > state.root.tick) {
      return [
        {
          code: "spy_cooldown_active",
          message: `Spy route to ${targetDistrict.name} is cooling down for ${activeSpyCooldownTick - state.root.tick} more ticks.`
        }
      ];
    }
    return [];
  };
  const createPlayerCooldownState$1 = (playerId, cooldownStateId) => ({
    id: cooldownStateId,
    ownerType: "player",
    ownerId: playerId,
    cooldowns: {},
    version: 1
  });
  const filterDefenseLoadout = (loadout) => Object.fromEntries(
    Object.entries(loadout).filter(([, amount]) => Math.max(0, Number(amount ?? 0)) > 0)
  );
  const reassignCapturedDistrictBuildings = (state, buildingIds, ownerPlayerId) => buildingIds.reduce((collection, buildingId) => {
    const building = collection[buildingId];
    return building ? {
      ...collection,
      [building.id]: {
        ...building,
        ownerPlayerId,
        version: building.version + 1
      }
    } : collection;
  }, state.buildingsById);
  const markDestroyedDistrictBuildings = (state, buildingIds) => buildingIds.reduce((collection, buildingId) => {
    const building = collection[buildingId];
    return building ? {
      ...collection,
      [building.id]: {
        ...building,
        status: "destroyed",
        version: building.version + 1
      }
    } : collection;
  }, state.buildingsById);
  const createBattleReportNotification = (input) => createNotification({
    id: composeEntityId("notification", `${input.command.id}:battle:${input.recipientPlayerId}`),
    recipientType: "player",
    recipientId: input.recipientPlayerId,
    category: "report.battle",
    title: `Battle report: ${input.targetDistrictId}`,
    bodyKey: "report.battle",
    payload: {
      reportId: composeEntityId("report", `${input.command.id}:battle:${input.recipientPlayerId}`),
      reportType: "battle",
      actionType: "attack-district",
      playerId: input.recipientPlayerId,
      attackerPlayerId: input.command.playerId,
      defenderPlayerId: input.defenderPlayerId,
      sourceDistrictId: input.command.payload.sourceDistrictId,
      targetDistrictId: input.targetDistrictId,
      result: input.result,
      districtCaptured: input.districtCaptured,
      districtDestroyed: input.districtDestroyed,
      trapTriggered: input.trapTriggered,
      attackerLosses: input.attackerLosses,
      detectedDefense: input.detectedDefense,
      tick: input.tick,
      createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
      eventId: input.eventId
    },
    createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    readAt: null
  });
  const createBattleReportNotifications = (input) => {
    const eventId = composeEntityId("event", `${input.command.id}:district-attacked`);
    const baseReport = {
      command: input.command,
      defenderPlayerId: input.defenderPlayerId,
      targetDistrictId: input.targetDistrict.id,
      result: input.result,
      districtCaptured: input.districtCaptured,
      districtDestroyed: input.districtDestroyed,
      trapTriggered: input.trapTriggered,
      attackerLosses: input.attackerLosses,
      detectedDefense: filterDefenseLoadout(input.targetDistrict.defenseLoadout),
      tick: input.tick,
      eventId
    };
    const attackerReport = createBattleReportNotification({
      ...baseReport,
      recipientPlayerId: input.attackerPlayerId
    });
    const defenderReport = input.defenderPlayerId && input.defenderPlayerId !== input.attackerPlayerId ? createBattleReportNotification({
      ...baseReport,
      recipientPlayerId: input.defenderPlayerId
    }) : null;
    return defenderReport ? [attackerReport, defenderReport] : [attackerReport];
  };
  const handleAttackDistrict = (state, command, context) => {
    var _a, _b, _c;
    const errors = validateAttack(state, command);
    if (errors.length > 0) {
      return {
        nextState: state,
        events: [],
        errors
      };
    }
    const attacker = state.playersById[command.playerId];
    const targetDistrict = state.districtsById[command.payload.districtId];
    const activeTrap = Object.values(state.trapsById).find(
      (trap) => trap.districtId === targetDistrict.id && trap.status === "active"
    );
    const trapResolution = activeTrap ? resolveTrap({
      attackLoadout: attacker.attackLoadout,
      trapAttackLosses: ((_a = context.config.balance.conflict) == null ? void 0 : _a.trapAttackLosses) ?? 1
    }) : {
      losses: {},
      nextLoadout: { ...attacker.attackLoadout },
      blocked: false
    };
    const effectiveLoadout = trapResolution.nextLoadout;
    const grenadeCount = effectiveLoadout.grenade ?? 0;
    const bazookaCount = effectiveLoadout.bazooka ?? 0;
    const towerCount = targetDistrict.defenseLoadout["defense-tower"] ?? 0;
    const baseAttackPower = calculateTotalAttackPower(attacker.attackLoadout);
    const trapAdjustedAttackPower = calculateTotalAttackPower(effectiveLoadout);
    const defensePower = calculateBaseDefensePower(targetDistrict.defenseLoadout);
    const effectiveAttackPower = calculateReducedAttackPowerFromTowers(trapAdjustedAttackPower, towerCount);
    const effectiveDefensePower = calculateEffectiveDefenseAfterGrenades(defensePower, grenadeCount);
    const catastropheRoll = deterministicUnitInterval(
      `${state.serverInstance.worldSeed}:attack:catastrophe:${command.playerId}:${targetDistrict.id}:${state.root.tick}:${command.id}`
    );
    const catastropheChance = Math.max(0, Math.min(1, Number(((_b = context.config.balance.conflict) == null ? void 0 : _b.catastropheChance) ?? 0)));
    const districtDestroyed = !trapResolution.blocked && catastropheRoll < catastropheChance;
    const attackSucceeded = !districtDestroyed && !trapResolution.blocked && effectiveAttackPower > effectiveDefensePower;
    const battleResult = trapResolution.blocked ? "blocked" : districtDestroyed ? "catastrophe" : attackSucceeded ? "success" : "failure";
    const currentCooldownState = state.cooldownStatesById[attacker.cooldownStateId] ?? createPlayerCooldownState$1(attacker.id, attacker.cooldownStateId);
    const attackCooldownKey = `attack:${targetDistrict.id}`;
    const notificationEntries = createBattleReportNotifications({
      command,
      attackerPlayerId: attacker.id,
      defenderPlayerId: targetDistrict.ownerPlayerId,
      targetDistrict,
      result: battleResult,
      districtCaptured: attackSucceeded,
      districtDestroyed,
      trapTriggered: Boolean(activeTrap),
      attackerLosses: trapResolution.losses,
      tick: state.root.tick
    });
    const attackerReport = notificationEntries[0];
    const defenderReport = notificationEntries[1] ?? null;
    const notificationIds = notificationEntries.map((notification) => notification.id);
    const nextBuildingsById = districtDestroyed ? markDestroyedDistrictBuildings(state, targetDistrict.buildingIds) : attackSucceeded ? reassignCapturedDistrictBuildings(state, targetDistrict.buildingIds, command.playerId) : state.buildingsById;
    const nextState = {
      ...state,
      playersById: {
        ...state.playersById,
        [attacker.id]: {
          ...attacker,
          attackLoadout: effectiveLoadout,
          lastActionAt: command.issuedAt,
          version: attacker.version + 1
        }
      },
      districtsById: {
        ...state.districtsById,
        [targetDistrict.id]: {
          ...targetDistrict,
          ownerPlayerId: districtDestroyed ? null : attackSucceeded ? command.playerId : targetDistrict.ownerPlayerId,
          controllerAllianceId: districtDestroyed ? null : attackSucceeded ? attacker.allianceId : targetDistrict.controllerAllianceId,
          heat: districtDestroyed ? 0 : targetDistrict.heat,
          influence: districtDestroyed ? 0 : targetDistrict.influence,
          buildingIds: districtDestroyed ? [] : targetDistrict.buildingIds,
          defenseLoadout: districtDestroyed ? {} : targetDistrict.defenseLoadout,
          status: districtDestroyed ? "destroyed" : attackSucceeded ? "claimed" : trapResolution.blocked ? targetDistrict.status : "contested",
          version: targetDistrict.version + 1
        }
      },
      buildingsById: nextBuildingsById,
      cooldownStatesById: {
        ...state.cooldownStatesById,
        [currentCooldownState.id]: {
          ...currentCooldownState,
          cooldowns: {
            ...currentCooldownState.cooldowns,
            [attackCooldownKey]: state.root.tick + (((_c = context.config.balance.conflict) == null ? void 0 : _c.attackCooldownTicks) ?? 2)
          },
          version: currentCooldownState.version + (state.cooldownStatesById[currentCooldownState.id] ? 1 : 0)
        }
      },
      trapsById: activeTrap ? {
        ...state.trapsById,
        [activeTrap.id]: {
          ...activeTrap,
          status: "triggered",
          triggeredAtTick: state.root.tick,
          version: activeTrap.version + 1
        }
      } : state.trapsById,
      notificationsById: notificationEntries.reduce(
        (collection, notification) => ({
          ...collection,
          [notification.id]: notification
        }),
        state.notificationsById
      ),
      root: {
        ...state.root,
        notificationIds: [...state.root.notificationIds, ...notificationIds],
        version: state.root.version + 1
      }
    };
    const events = [
      createEvent(CORE_EVENT_TYPES.districtAttacked, {
        attackerPlayerId: command.playerId,
        districtId: targetDistrict.id,
        attackPower: baseAttackPower,
        attackPowerAfterTrap: trapAdjustedAttackPower,
        attackPowerAfterTowers: effectiveAttackPower,
        defensePower,
        defensePowerAfterGrenades: effectiveDefensePower,
        smgComboBonus: calculateSmgComboBonus(effectiveLoadout),
        grenadeDefenseIgnorePercent: calculateGrenadeDefenseIgnorePercent(grenadeCount),
        towerAttackReductionPercent: calculateTowerAttackReductionPercent(towerCount),
        bazookaTotalDestructionBonusPercent: calculateBazookaTotalDestructionBonusPercent(bazookaCount),
        attackSucceeded,
        districtDestroyed,
        catastropheRoll,
        trapTriggered: Boolean(activeTrap),
        attackerLosses: trapResolution.losses
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: attackerReport.id,
        recipientId: attackerReport.recipientId,
        category: attackerReport.category
      })
    ];
    if (defenderReport) {
      events.push(
        createEvent(CORE_EVENT_TYPES.notificationCreated, {
          notificationId: defenderReport.id,
          recipientId: defenderReport.recipientId,
          category: defenderReport.category
        })
      );
    }
    if (activeTrap) {
      events.push(
        createEvent(CORE_EVENT_TYPES.trapTriggered, {
          trapId: activeTrap.id,
          districtId: targetDistrict.id,
          attackerPlayerId: attacker.id
        })
      );
    }
    if (attackSucceeded) {
      events.push(
        createEvent(CORE_EVENT_TYPES.districtCaptured, {
          attackerPlayerId: command.playerId,
          districtId: targetDistrict.id,
          previousOwnerPlayerId: targetDistrict.ownerPlayerId
        })
      );
    }
    return {
      nextState,
      events,
      errors: []
    };
  };
  const placeBuilding = (state, command, context) => {
    var _a;
    const buildingId = composeEntityId("building", command.id);
    const district = state.districtsById[command.payload.districtId];
    const productionProfile = (_a = context.config.balance.productionBuildings) == null ? void 0 : _a[command.payload.buildingTypeId];
    const building = {
      id: buildingId,
      serverInstanceId: state.serverInstance.id,
      districtId: district.id,
      ownerPlayerId: command.playerId,
      buildingTypeId: command.payload.buildingTypeId,
      level: 1,
      status: "active",
      processing: null,
      actionCooldowns: {},
      startedAt: command.issuedAt,
      completedAt: command.issuedAt,
      version: 1
    };
    const resourceState = productionProfile ? createBuildingProductionResourceState(building, productionProfile.resourceKey, state.root.tick) : null;
    return {
      building,
      nextState: {
        ...state,
        districtsById: {
          ...state.districtsById,
          [district.id]: {
            ...district,
            buildingIds: [...district.buildingIds, building.id],
            version: district.version + 1
          }
        },
        buildingsById: {
          ...state.buildingsById,
          [building.id]: building
        },
        resourceStatesById: resourceState ? {
          ...state.resourceStatesById,
          [resourceState.id]: resourceState
        } : state.resourceStatesById
      }
    };
  };
  const createBuildingProductionResourceState = (building, resourceKey, tick) => ({
    id: composeEntityId("resource", building.id),
    ownerType: "building",
    ownerId: building.id,
    balances: {
      [resourceKey]: 0
    },
    incomeModifiers: {},
    lastUpdatedTick: tick,
    version: 1
  });
  const handleBuildStructure = (state, command, context) => {
    const errors = validateBuildStructure(state, command, context);
    if (errors.length > 0) {
      return {
        nextState: state,
        events: [],
        errors
      };
    }
    const { nextState, building } = placeBuilding(state, command, context);
    return {
      nextState,
      events: [
        createEvent(CORE_EVENT_TYPES.buildingPlaced, {
          buildingId: building.id,
          districtId: building.districtId,
          playerId: building.ownerPlayerId,
          buildingTypeId: building.buildingTypeId
        })
      ],
      errors: []
    };
  };
  const handleCollectProduction = (state, command, context) => {
    var _a, _b;
    const errors = validateCollect(state, command, context);
    if (errors.length > 0) {
      return {
        nextState: state,
        events: [],
        errors
      };
    }
    const building = state.buildingsById[command.payload.buildingId];
    const player = state.playersById[command.playerId];
    const productionProfile = (_a = context.config.balance.productionBuildings) == null ? void 0 : _a[building.buildingTypeId];
    if (!productionProfile) {
      return {
        nextState: state,
        events: [],
        errors: [
          {
            code: "production_not_supported",
            message: "The target building does not support migrated production collection."
          }
        ]
      };
    }
    const buildingResourceStateId = composeEntityId("resource", building.id);
    const buildingResourceState = state.resourceStatesById[buildingResourceStateId];
    const collectedAmount = Math.max(
      0,
      Number(((_b = buildingResourceState == null ? void 0 : buildingResourceState.balances) == null ? void 0 : _b[(productionProfile == null ? void 0 : productionProfile.resourceKey) || ""]) || 0)
    );
    const playerResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState$2(player, state.root.tick);
    const nextBuildingResourceState = {
      ...buildingResourceState,
      balances: {
        ...buildingResourceState.balances,
        [productionProfile.resourceKey]: 0
      },
      lastUpdatedTick: state.root.tick,
      version: buildingResourceState.version + 1
    };
    const nextPlayerResourceState = {
      ...playerResourceState,
      balances: {
        ...playerResourceState.balances,
        [productionProfile.resourceKey]: Math.max(
          0,
          Number(playerResourceState.balances[productionProfile.resourceKey] || 0) + collectedAmount
        )
      },
      lastUpdatedTick: state.root.tick,
      version: playerResourceState.version + (state.resourceStatesById[player.resourceStateId] ? 1 : 0)
    };
    return {
      nextState: {
        ...state,
        resourceStatesById: {
          ...state.resourceStatesById,
          [buildingResourceStateId]: nextBuildingResourceState,
          [playerResourceState.id]: nextPlayerResourceState
        }
      },
      events: [
        createEvent(CORE_EVENT_TYPES.productionCollected, {
          playerId: command.playerId,
          districtId: command.payload.districtId,
          buildingId: command.payload.buildingId,
          resourceKey: productionProfile.resourceKey,
          amount: collectedAmount
        })
      ],
      errors: []
    };
  };
  const createPlayerResourceState$2 = (player, tick) => ({
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: player.id,
    balances: {},
    incomeModifiers: {},
    lastUpdatedTick: tick,
    version: 1
  });
  const handleCraftItem = (state, command, context) => ({
    nextState: (() => {
      var _a;
      const errors = validateCraft(state, command, context);
      if (errors.length > 0) {
        return state;
      }
      const player = state.playersById[command.playerId];
      const building = state.buildingsById[command.payload.buildingId];
      const craftProfile = (_a = context.config.balance.craftBuildings) == null ? void 0 : _a[building.buildingTypeId];
      const recipe = craftProfile == null ? void 0 : craftProfile.recipes[command.payload.recipeId];
      if (!player || !recipe) {
        return state;
      }
      const currentResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState$1(player, state.root.tick);
      const nextBalances = {
        ...currentResourceState.balances
      };
      for (const [resourceKey, requiredAmount] of Object.entries(recipe.inputCosts)) {
        nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) - requiredAmount);
      }
      const nextPlayerResourceState = {
        ...currentResourceState,
        balances: nextBalances,
        lastUpdatedTick: state.root.tick,
        version: currentResourceState.version + (state.resourceStatesById[player.resourceStateId] ? 1 : 0)
      };
      const durationTicks = resolveCraftProcessingDurationTicks(
        recipe.durationTicks,
        context.config.balance.cooldownMultiplier
      );
      const nextBuilding = {
        ...building,
        processing: {
          recipeId: command.payload.recipeId,
          startedAtTick: state.root.tick,
          completesAtTick: state.root.tick + durationTicks
        },
        version: building.version + 1
      };
      return {
        ...state,
        buildingsById: {
          ...state.buildingsById,
          [nextBuilding.id]: nextBuilding
        },
        resourceStatesById: {
          ...state.resourceStatesById,
          [nextPlayerResourceState.id]: nextPlayerResourceState
        }
      };
    })(),
    events: (() => {
      var _a, _b;
      const errors = validateCraft(state, command, context);
      if (errors.length > 0) {
        return [];
      }
      const building = state.buildingsById[command.payload.buildingId];
      const recipe = (_b = (_a = context.config.balance.craftBuildings) == null ? void 0 : _a[building.buildingTypeId]) == null ? void 0 : _b.recipes[command.payload.recipeId];
      return recipe ? [
        createEvent(CORE_EVENT_TYPES.itemProcessingStarted, {
          playerId: command.playerId,
          districtId: command.payload.districtId,
          buildingId: command.payload.buildingId,
          recipeId: command.payload.recipeId,
          completesAtTick: state.root.tick + resolveCraftProcessingDurationTicks(
            recipe.durationTicks,
            context.config.balance.cooldownMultiplier
          )
        })
      ] : [];
    })(),
    errors: validateCraft(state, command, context)
  });
  const createPlayerResourceState$1 = (player, tick) => ({
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: player.id,
    balances: {},
    incomeModifiers: {},
    lastUpdatedTick: tick,
    version: 1
  });
  const handlePlaceTrap = (state, command, _context) => {
    const errors = validatePlaceTrap(state, command);
    if (errors.length > 0) {
      return {
        nextState: state,
        events: [],
        errors
      };
    }
    const player = state.playersById[command.playerId];
    const district = state.districtsById[command.payload.districtId];
    const trapId = composeEntityId("trap", district.id);
    const previousTrap = state.trapsById[trapId];
    const trap = {
      id: trapId,
      serverInstanceId: state.serverInstance.id,
      districtId: district.id,
      ownerPlayerId: command.playerId,
      status: "active",
      placedAtTick: state.root.tick,
      triggeredAtTick: null,
      version: previousTrap ? previousTrap.version + 1 : 1
    };
    const nextState = {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: {
          ...player,
          lastActionAt: command.issuedAt,
          version: player.version + 1
        }
      },
      trapsById: {
        ...state.trapsById,
        [trap.id]: trap
      },
      root: {
        ...state.root,
        trapIds: state.root.trapIds.includes(trap.id) ? state.root.trapIds : [...state.root.trapIds, trap.id],
        version: state.root.version + (state.root.trapIds.includes(trap.id) ? 0 : 1)
      }
    };
    return {
      nextState,
      events: [
        createEvent(CORE_EVENT_TYPES.trapPlaced, {
          trapId: trap.id,
          districtId: district.id,
          playerId: player.id
        })
      ],
      errors: []
    };
  };
  const handleSpyDistrict = (state, command, context) => {
    var _a, _b, _c;
    const errors = validateSpy(state, command);
    if (errors.length > 0) {
      return {
        nextState: state,
        events: [],
        errors
      };
    }
    const player = state.playersById[command.playerId];
    const targetDistrict = state.districtsById[command.payload.districtId];
    const cooldownState = state.cooldownStatesById[player.cooldownStateId] ?? createPlayerCooldownState(player.id, player.cooldownStateId);
    const activeTrap = Object.values(state.trapsById).find(
      (trap) => trap.districtId === targetDistrict.id && trap.status === "active"
    );
    const reportEventId = composeEntityId("event", `${command.id}:district-spied`);
    const reportResult = resolveSpy({
      worldSeed: state.serverInstance.worldSeed,
      playerId: player.id,
      targetDistrictId: targetDistrict.id,
      tick: state.root.tick,
      defenseLoadout: targetDistrict.defenseLoadout,
      hasActiveTrap: Boolean(activeTrap),
      spyBaseSuccessChance: ((_a = context.config.balance.conflict) == null ? void 0 : _a.spyBaseSuccessChance) ?? 0.72,
      spyTrapRevealChance: ((_b = context.config.balance.conflict) == null ? void 0 : _b.spyTrapRevealChance) ?? 0.22
    });
    const report = createSpyReportNotification({
      command,
      playerId: player.id,
      targetDistrictId: targetDistrict.id,
      reportResult,
      tick: state.root.tick,
      eventId: reportEventId
    });
    const spyCooldownKey = `spy:${targetDistrict.id}`;
    return {
      nextState: {
        ...state,
        playersById: {
          ...state.playersById,
          [player.id]: {
            ...player,
            lastActionAt: command.issuedAt,
            version: player.version + 1
          }
        },
        cooldownStatesById: {
          ...state.cooldownStatesById,
          [cooldownState.id]: {
            ...cooldownState,
            cooldowns: {
              ...cooldownState.cooldowns,
              [spyCooldownKey]: state.root.tick + (((_c = context.config.balance.conflict) == null ? void 0 : _c.spyCooldownTicks) ?? 2)
            },
            version: cooldownState.version + (state.cooldownStatesById[cooldownState.id] ? 1 : 0)
          }
        },
        notificationsById: {
          ...state.notificationsById,
          [report.id]: report
        },
        root: {
          ...state.root,
          notificationIds: [...state.root.notificationIds, report.id],
          version: state.root.version + 1
        }
      },
      events: [
        createEvent(CORE_EVENT_TYPES.districtSpied, {
          attackerPlayerId: player.id,
          sourceDistrictId: command.payload.sourceDistrictId,
          targetDistrictId: targetDistrict.id,
          result: reportResult.result,
          trapDetected: reportResult.trapDetected
        }),
        createEvent(CORE_EVENT_TYPES.notificationCreated, {
          notificationId: report.id,
          recipientId: player.id,
          category: report.category
        })
      ],
      errors: []
    };
  };
  const createPlayerCooldownState = (playerId, cooldownStateId) => ({
    id: cooldownStateId,
    ownerType: "player",
    ownerId: playerId,
    cooldowns: {},
    version: 1
  });
  const createSpyReportNotification = (input) => createNotification({
    id: composeEntityId("notification", `${input.command.id}:spy-report`),
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.spy",
    title: `Spy report: ${input.targetDistrictId}`,
    bodyKey: "report.spy",
    payload: {
      reportId: composeEntityId("report", `${input.command.id}:spy`),
      reportType: "spy",
      actionType: "spy-district",
      playerId: input.playerId,
      attackerPlayerId: input.command.playerId,
      sourceDistrictId: input.command.payload.sourceDistrictId,
      targetDistrictId: input.targetDistrictId,
      result: input.reportResult.result,
      detectedDefense: input.reportResult.detectedDefense,
      trapDetected: input.reportResult.trapDetected,
      tick: input.tick,
      createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
      eventId: input.eventId
    },
    createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    readAt: null
  });
  const resolveBuildingActionSpecialEffect = (input) => {
    if (input.actionId === "armory_fortify") {
      const defenseAdded = {
        barricades: 2,
        cameras: 1,
        alarm: 1
      };
      return {
        nextDistrict: {
          ...input.district,
          defenseLoadout: addDefenseLoadout(input.district.defenseLoadout, defenseAdded)
        },
        defenseAdded,
        intelRevealedDistrictIds: [],
        intelDetectedDefense: {},
        messages: [
          "Armory crews reinforced this district with barricades, cameras, and an alarm.",
          "The added defense is now part of attack and spy resolution."
        ]
      };
    }
    if (input.actionId === "data_center_tracking") {
      const intelRevealedDistrictIds = getIntelDistrictIds(input.state, input.district, 3);
      return {
        nextDistrict: input.district,
        defenseAdded: {},
        intelRevealedDistrictIds,
        intelDetectedDefense: Object.fromEntries(
          intelRevealedDistrictIds.map((districtId) => {
            var _a;
            return [
              districtId,
              ((_a = input.state.districtsById[districtId]) == null ? void 0 : _a.defenseLoadout) ?? {}
            ];
          })
        ),
        messages: intelRevealedDistrictIds.length > 0 ? intelRevealedDistrictIds.map((districtId) => `Data center tracked ${districtId}.`) : ["Data center found no adjacent district to track."]
      };
    }
    if (input.actionId === "restaurant_street_gossip") {
      const intelRevealedDistrictIds = getIntelDistrictIds(input.state, input.district, 2);
      return {
        nextDistrict: input.district,
        defenseAdded: {},
        intelRevealedDistrictIds,
        intelDetectedDefense: {},
        messages: intelRevealedDistrictIds.length > 0 ? intelRevealedDistrictIds.map((districtId) => `Street gossip revealed activity around ${districtId}.`) : ["Street gossip did not find a useful lead."]
      };
    }
    return {
      nextDistrict: input.district,
      defenseAdded: {},
      intelRevealedDistrictIds: [],
      intelDetectedDefense: {},
      messages: []
    };
  };
  const addDefenseLoadout = (currentLoadout, addedLoadout) => ({
    ...currentLoadout,
    ...Object.fromEntries(
      Object.entries(addedLoadout).map(([weaponId, amount]) => [
        weaponId,
        Math.max(0, Number(currentLoadout[weaponId] || 0) + Number(amount || 0))
      ])
    )
  });
  const getIntelDistrictIds = (state, district, limit) => district.adjacentDistrictIds.filter((districtId) => {
    const candidate = state.districtsById[districtId];
    return Boolean(candidate && candidate.status !== "destroyed");
  }).slice(0, limit);
  const handleUseBuildingAction = (state, command, context) => {
    var _a;
    const errors = validateRunBuildingAction(state, command, context);
    if (errors.length > 0) {
      return {
        nextState: state,
        events: [],
        errors
      };
    }
    const player = state.playersById[command.playerId];
    const district = state.districtsById[command.payload.districtId];
    const building = state.buildingsById[command.payload.buildingId];
    const action = (_a = context.config.balance.buildingActions) == null ? void 0 : _a[command.payload.actionId];
    if (!player || !district || !building || !action) {
      return {
        nextState: state,
        events: [],
        errors: [
          {
            code: "building_action_invalid_state",
            message: "Building action state changed before execution."
          }
        ]
      };
    }
    const currentPlayerResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);
    const nextBalances = {
      ...currentPlayerResourceState.balances
    };
    for (const [resourceKey, amount] of Object.entries(action.inputCost)) {
      nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) - amount);
    }
    for (const [resourceKey, amount] of Object.entries(action.outputGain)) {
      nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) + amount);
    }
    const nextPlayerResourceState = {
      ...currentPlayerResourceState,
      balances: nextBalances,
      lastUpdatedTick: state.root.tick,
      version: currentPlayerResourceState.version + (state.resourceStatesById[player.resourceStateId] ? 1 : 0)
    };
    const cooldownTicks = resolveBuildingActionCooldownTicks(action, context);
    const nextBuilding = {
      ...building,
      actionCooldowns: {
        ...building.actionCooldowns ?? {},
        [action.actionId]: state.root.tick + cooldownTicks
      },
      version: building.version + 1
    };
    const baseNextDistrict = {
      ...district,
      heat: Math.max(0, Number(district.heat || 0) + action.heatGain),
      influence: Math.max(0, Number(district.influence || 0) + action.influenceChange),
      version: district.version + 1
    };
    const specialEffect = resolveBuildingActionSpecialEffect({
      state,
      district: baseNextDistrict,
      actionId: action.actionId
    });
    const nextDistrict = specialEffect.nextDistrict;
    const nextPlayer = {
      ...player,
      lastActionAt: command.issuedAt,
      version: player.version + 1
    };
    const eventId = composeEntityId("event", `${command.id}:building-action`);
    const notification = createBuildingActionReportNotification({
      command,
      action,
      districtId: district.id,
      buildingId: building.id,
      buildingTypeId: building.buildingTypeId,
      playerId: player.id,
      specialEffect,
      tick: state.root.tick,
      eventId
    });
    return {
      nextState: {
        ...state,
        playersById: {
          ...state.playersById,
          [player.id]: nextPlayer
        },
        districtsById: {
          ...state.districtsById,
          [district.id]: nextDistrict
        },
        buildingsById: {
          ...state.buildingsById,
          [building.id]: nextBuilding
        },
        resourceStatesById: {
          ...state.resourceStatesById,
          [nextPlayerResourceState.id]: nextPlayerResourceState
        },
        notificationsById: {
          ...state.notificationsById,
          [notification.id]: notification
        },
        root: {
          ...state.root,
          notificationIds: [...state.root.notificationIds, notification.id],
          version: state.root.version + 1
        }
      },
      events: [
        createEvent(CORE_EVENT_TYPES.buildingActionResolved, {
          playerId: player.id,
          districtId: district.id,
          buildingId: building.id,
          buildingTypeId: building.buildingTypeId,
          actionId: action.actionId,
          outputGain: action.outputGain,
          heatGain: action.heatGain,
          influenceChange: action.influenceChange,
          defenseAdded: specialEffect.defenseAdded,
          intelRevealedDistrictIds: specialEffect.intelRevealedDistrictIds
        }),
        createEvent(CORE_EVENT_TYPES.notificationCreated, {
          notificationId: notification.id,
          recipientId: player.id,
          category: notification.category
        })
      ],
      errors: []
    };
  };
  const resolveBuildingActionCooldownTicks = (action, context) => {
    const cooldownMs = Math.max(0, Number(action.cooldownMs || action.durationMs || 0));
    const rawTicks = Math.ceil(cooldownMs / Math.max(1, context.config.tickRateMs));
    return Math.max(1, Math.ceil(rawTicks * context.config.balance.cooldownMultiplier));
  };
  const createPlayerResourceState = (player, tick) => ({
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: player.id,
    balances: {},
    incomeModifiers: {},
    lastUpdatedTick: tick,
    version: 1
  });
  const createBuildingActionReportNotification = (input) => createNotification({
    id: composeEntityId("notification", `${input.command.id}:building-action-report`),
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.building-action",
    title: input.action.label,
    bodyKey: "report.building-action",
    payload: {
      reportId: composeEntityId("report", `${input.command.id}:building-action`),
      reportType: "building-action",
      actionType: "run-building-action",
      playerId: input.playerId,
      districtId: input.districtId,
      buildingId: input.buildingId,
      buildingTypeId: input.buildingTypeId,
      buildingActionId: input.action.actionId,
      actionLabel: input.action.label,
      result: "success",
      inputCost: input.action.inputCost,
      outputGain: input.action.outputGain,
      defenseAdded: input.specialEffect.defenseAdded,
      intelRevealedDistrictIds: input.specialEffect.intelRevealedDistrictIds,
      intelDetectedDefense: input.specialEffect.intelDetectedDefense,
      messages: input.specialEffect.messages,
      heatGain: input.action.heatGain,
      influenceChange: input.action.influenceChange,
      reportText: input.action.reportText,
      tick: input.tick,
      createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
      eventId: input.eventId
    },
    createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    readAt: null
  });
  const routeCommand = (state, command, context) => {
    switch (command.type) {
      case "attack-district":
        return handleAttackDistrict(state, command, context);
      case "build-structure":
        return handleBuildStructure(state, command, context);
      case "collect-production":
        return handleCollectProduction(state, command, context);
      case "craft-item":
        return handleCraftItem(state, command, context);
      case "place-trap":
        return handlePlaceTrap(state, command);
      case "run-building-action":
        return handleUseBuildingAction(state, command, context);
      case "spy-district":
        return handleSpyDistrict(state, command, context);
      default:
        return {
          nextState: state,
          events: [],
          errors: [
            {
              code: "unsupported_command",
              message: "Unsupported command type."
            }
          ]
        };
    }
  };
  const applyCommand = (state, command, context) => routeCommand(state, command, context);
  const runTick = (state, context) => {
    const advancedState = {
      ...state,
      serverInstance: {
        ...state.serverInstance,
        currentTick: state.serverInstance.currentTick + 1
      },
      root: {
        ...state.root,
        tick: state.root.tick + 1
      }
    };
    const producedState = completeProduction(advancedState, context);
    const processingResult = completeCraftProcessing(producedState, context);
    const nextState = processingResult.nextState;
    return {
      nextState,
      events: processingResult.events
    };
  };
  const createInitialState = (instanceId, mode) => {
    const serverInstance = {
      id: instanceId,
      mode,
      configKey: mode,
      status: "pending",
      startedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
      endedAt: null,
      worldSeed: "pending-seed",
      currentTick: 0,
      gameStateId: `${instanceId}:root`,
      version: 1
    };
    const root = {
      id: serverInstance.gameStateId,
      serverInstanceId: instanceId,
      tick: 0,
      phase: PRODUCTION_GAME_LIFECYCLE_PHASES.bootstrapping,
      playerIds: [],
      allianceIds: [],
      districtIds: [],
      eventIds: [],
      trapIds: [],
      notificationIds: [],
      victoryStateId: null,
      matchResultId: null,
      version: 1
    };
    return {
      serverInstance,
      root,
      playersById: {},
      alliancesById: {},
      districtsById: {},
      buildingsById: {},
      resourceStatesById: {},
      cooldownStatesById: {},
      effectStatesById: {},
      policeStatesById: {},
      eventsById: {},
      trapsById: {},
      notificationsById: {},
      victoryState: null,
      matchResult: null
    };
  };
  const createConflictReportViews = (state, input) => [...state.root.notificationIds].reverse().map((notificationId) => state.notificationsById[notificationId]).filter((notification) => (notification == null ? void 0 : notification.recipientId) === input.playerId).map(mapNotificationToReport).filter((report) => report !== null).slice(0, input.limit);
  const mapNotificationToReport = (notification) => {
    const payload = notification.payload;
    if (notification.category === "report.spy") {
      return {
        reportId: String(payload.reportId ?? notification.id),
        reportType: "spy",
        actionType: "spy-district",
        playerId: String(payload.playerId ?? notification.recipientId),
        attackerPlayerId: String(payload.attackerPlayerId ?? notification.recipientId),
        sourceDistrictId: String(payload.sourceDistrictId ?? ""),
        targetDistrictId: String(payload.targetDistrictId ?? ""),
        result: payload.result === "success" ? "success" : "failure",
        detectedDefense: asNumberRecord(payload.detectedDefense),
        trapDetected: Boolean(payload.trapDetected),
        tick: Number(payload.tick ?? 0),
        createdAt: String(payload.createdAt ?? notification.createdAt),
        eventId: payload.eventId ? String(payload.eventId) : null
      };
    }
    if (notification.category === "report.battle") {
      const result = payload.result === "success" || payload.result === "blocked" || payload.result === "catastrophe" ? payload.result : "failure";
      return {
        reportId: String(payload.reportId ?? notification.id),
        reportType: "battle",
        actionType: "attack-district",
        playerId: String(payload.playerId ?? notification.recipientId),
        attackerPlayerId: String(payload.attackerPlayerId ?? notification.recipientId),
        defenderPlayerId: payload.defenderPlayerId ? String(payload.defenderPlayerId) : null,
        sourceDistrictId: String(payload.sourceDistrictId ?? ""),
        targetDistrictId: String(payload.targetDistrictId ?? ""),
        result,
        districtCaptured: Boolean(payload.districtCaptured),
        districtDestroyed: Boolean(payload.districtDestroyed),
        trapTriggered: Boolean(payload.trapTriggered),
        attackerLosses: asNumberRecord(payload.attackerLosses),
        detectedDefense: asNumberRecord(payload.detectedDefense),
        tick: Number(payload.tick ?? 0),
        createdAt: String(payload.createdAt ?? notification.createdAt),
        eventId: payload.eventId ? String(payload.eventId) : null
      };
    }
    if (notification.category === "report.building-action") {
      return {
        reportId: String(payload.reportId ?? notification.id),
        reportType: "building-action",
        actionType: "run-building-action",
        playerId: String(payload.playerId ?? notification.recipientId),
        districtId: String(payload.districtId ?? ""),
        buildingId: String(payload.buildingId ?? ""),
        buildingTypeId: String(payload.buildingTypeId ?? ""),
        buildingActionId: String(payload.buildingActionId ?? ""),
        result: "success",
        inputCost: asNumberRecord(payload.inputCost),
        outputGain: asNumberRecord(payload.outputGain),
        defenseAdded: asNumberRecord(payload.defenseAdded),
        intelRevealedDistrictIds: asStringArray(payload.intelRevealedDistrictIds),
        intelDetectedDefense: asNumberRecordByKey(payload.intelDetectedDefense),
        messages: asStringArray(payload.messages),
        heatGain: Number(payload.heatGain ?? 0),
        influenceChange: Number(payload.influenceChange ?? 0),
        tick: Number(payload.tick ?? 0),
        createdAt: String(payload.createdAt ?? notification.createdAt),
        eventId: payload.eventId ? String(payload.eventId) : null
      };
    }
    return null;
  };
  const asNumberRecord = (value) => {
    if (!value || typeof value !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        Number(entryValue ?? 0)
      ])
    );
  };
  const asStringArray = (value) => Array.isArray(value) ? value.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
  const asNumberRecordByKey = (value) => {
    if (!value || typeof value !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        asNumberRecord(entryValue)
      ])
    );
  };
  const createDistrictAttackTargetViews = (state, playerId, sourceDistrictId) => {
    const sourceDistrict = state.districtsById[sourceDistrictId];
    if (!sourceDistrict || sourceDistrict.ownerPlayerId !== playerId) {
      return [];
    }
    return sourceDistrict.adjacentDistrictIds.map((districtId) => state.districtsById[districtId]).filter((district) => district !== void 0).map((targetDistrict) => {
      var _a;
      const previewCommand = {
        id: `preview:attack:${sourceDistrict.id}:${targetDistrict.id}`,
        mode: state.serverInstance.mode,
        playerId,
        serverInstanceId: state.serverInstance.id,
        issuedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
        payload: {
          districtId: targetDistrict.id,
          sourceDistrictId: sourceDistrict.id
        }
      };
      const errors = validateAttack(state, previewCommand);
      return {
        districtId: targetDistrict.id,
        name: targetDistrict.name,
        ownerPlayerId: targetDistrict.ownerPlayerId,
        status: targetDistrict.status,
        enabled: errors.length === 0,
        disabledReason: ((_a = errors[0]) == null ? void 0 : _a.message) ?? null
      };
    });
  };
  const createDistrictPanelBuildingViews = (input) => {
    const buildingDefinitions = Object.fromEntries(input.buildCatalog.map((entry) => [entry.buildingTypeId, entry]));
    return input.buildings.map((building) => {
      const definition = buildingDefinitions[building.buildingTypeId];
      const actions = createBuildingActionViews({
        actionCatalog: input.actionCatalog,
        building,
        district: input.district,
        playerId: input.playerId,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const baseLabel = (definition == null ? void 0 : definition.label) ?? formatResourceLabel$1(building.buildingTypeId);
      const variantName = normalizeBuildingDisplayName(building.displayName) ?? resolveCatalogVariantName(definition, building.id);
      return {
        buildingId: building.id,
        buildingTypeId: building.buildingTypeId,
        label: baseLabel,
        displayName: variantName ?? baseLabel,
        variantName,
        zone: (definition == null ? void 0 : definition.zone) ?? input.district.zone,
        role: (definition == null ? void 0 : definition.role) ?? "Fixed building",
        info: (definition == null ? void 0 : definition.info) ?? "Fixed district building.",
        stats: createBuildingStats(definition),
        specialActions: createSpecialActionViews(definition, actions),
        level: building.level,
        status: building.status,
        actionCooldowns: { ...building.actionCooldowns ?? {} },
        actions
      };
    });
  };
  const createBuildingStats = (definition) => {
    const stats = definition == null ? void 0 : definition.stats;
    return [
      { label: "Clean / h", value: `$${formatNumber((stats == null ? void 0 : stats.cleanPerHour) ?? 0)}` },
      { label: "Dirty / h", value: `$${formatNumber((stats == null ? void 0 : stats.dirtyPerHour) ?? 0)}` },
      { label: "Heat / day", value: formatNumber((stats == null ? void 0 : stats.heatPerDay) ?? 0) },
      { label: "Influence / day", value: formatNumber((stats == null ? void 0 : stats.influencePerDay) ?? 0) },
      { label: "Max level", value: String((stats == null ? void 0 : stats.maxLevel) ?? 1) }
    ];
  };
  const normalizeBuildingDisplayName = (value) => {
    const normalized = String(value || "").trim();
    return normalized || null;
  };
  const resolveCatalogVariantName = (definition, seed) => {
    const variants = (definition == null ? void 0 : definition.nameVariants) ?? [];
    if (variants.length < 1) {
      return null;
    }
    return variants[hashString(seed) % variants.length] ?? null;
  };
  const hashString = (value) => {
    const text = String(value || "");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = hash * 31 + text.charCodeAt(index) >>> 0;
    }
    return hash;
  };
  const createSpecialActionViews = (definition, actions) => ((definition == null ? void 0 : definition.specialActions) ?? []).map((specialAction) => {
    const commandAction = actions.find((action) => action.actionId === specialAction.actionId);
    return {
      actionId: specialAction.actionId,
      label: specialAction.label,
      description: specialAction.description,
      effectSummary: specialAction.effectSummary,
      durationMs: specialAction.durationMs,
      cooldownMs: specialAction.cooldownMs,
      cooldownRemainingTicks: (commandAction == null ? void 0 : commandAction.cooldownRemainingTicks) ?? 0,
      heatGain: specialAction.heatGain,
      enabled: (commandAction == null ? void 0 : commandAction.enabled) ?? false,
      disabledReason: (commandAction == null ? void 0 : commandAction.disabledReason) ?? "This special action is not wired to the command dispatcher yet."
    };
  });
  const createBuildingActionViews = (input) => Object.values(input.actionCatalog).filter((action) => action.buildingType === input.building.buildingTypeId).map((action) => {
    const cooldownUntilTick = Math.max(0, Number((input.building.actionCooldowns ?? {})[action.actionId] || 0));
    const cooldownRemainingTicks = Math.max(0, cooldownUntilTick - input.tick);
    const missingCosts = Object.entries(action.inputCost).filter(
      ([resourceKey, requiredAmount]) => Math.max(0, Number(input.playerBalances[resourceKey] || 0)) < requiredAmount
    );
    const ownerBlocked = action.requiredOwner && (input.district.ownerPlayerId !== input.playerId || input.building.ownerPlayerId !== input.playerId);
    const disabledReason = ownerBlocked ? "Only the district owner can run this building action." : input.building.status !== "active" ? "Only active fixed buildings can run actions." : input.district.status === "contested" && !action.allowedIfContested ? "This action is blocked while the district is contested." : cooldownRemainingTicks > 0 ? `Cooldown ${formatTickLabel$1(cooldownRemainingTicks)}.` : missingCosts.length > 0 ? `Need ${formatInputSummary$1(Object.fromEntries(missingCosts))}.` : null;
    return {
      actionId: action.actionId,
      label: action.label,
      description: action.description,
      durationMs: action.durationMs,
      cooldownMs: action.cooldownMs,
      cooldownRemainingTicks,
      inputCost: { ...action.inputCost },
      outputGain: { ...action.outputGain },
      heatGain: action.heatGain,
      influenceChange: action.influenceChange,
      reportText: action.reportText,
      enabled: disabledReason === null,
      disabledReason
    };
  });
  const formatInputSummary$1 = (inputCosts) => Object.entries(inputCosts).map(([resourceKey, amount]) => `${amount} ${formatResourceLabel$1(resourceKey)}`).join(" + ");
  const formatResourceLabel$1 = (resourceKey) => resourceKey.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
  const formatNumber = (value) => {
    const normalized = Number(value || 0);
    return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
  };
  const formatTickLabel$1 = (tickCount) => `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;
  const createDistrictSpyTargetViews = (state, playerId, sourceDistrictId) => {
    const sourceDistrict = state.districtsById[sourceDistrictId];
    if (!sourceDistrict || sourceDistrict.ownerPlayerId !== playerId) {
      return [];
    }
    return sourceDistrict.adjacentDistrictIds.map((districtId) => state.districtsById[districtId]).filter((district) => district !== void 0).map((targetDistrict) => {
      var _a;
      const previewCommand = {
        id: `preview:spy:${sourceDistrict.id}:${targetDistrict.id}`,
        mode: state.serverInstance.mode,
        playerId,
        serverInstanceId: state.serverInstance.id,
        issuedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
        payload: {
          districtId: targetDistrict.id,
          sourceDistrictId: sourceDistrict.id
        }
      };
      const errors = validateSpy(state, previewCommand);
      return {
        districtId: targetDistrict.id,
        name: targetDistrict.name,
        ownerPlayerId: targetDistrict.ownerPlayerId,
        status: targetDistrict.status,
        enabled: errors.length === 0,
        disabledReason: ((_a = errors[0]) == null ? void 0 : _a.message) ?? null
      };
    });
  };
  const createDistrictPanelView = (state, input) => {
    var _a;
    const district = state.districtsById[input.districtId];
    if (!district) {
      return null;
    }
    const filledBuildings = district.buildingIds.map((buildingId) => state.buildingsById[buildingId]).filter((building) => building !== void 0 && building.status !== "destroyed");
    const filledSlotCount = filledBuildings.length;
    const isOwnedByPlayer = district.ownerPlayerId === input.playerId;
    const player = state.playersById[input.playerId];
    const playerBalances = player ? ((_a = state.resourceStatesById[player.resourceStateId]) == null ? void 0 : _a.balances) ?? {} : {};
    const attackTargets = createDistrictAttackTargetViews(state, input.playerId, district.id);
    const spyTargets = createDistrictSpyTargetViews(state, input.playerId, district.id);
    const trap = createTrapView(state, input.playerId, district.id);
    const isDestroyed = district.status === "destroyed";
    return {
      districtId: district.id,
      name: district.name,
      zone: district.zone,
      status: district.status,
      ownerPlayerId: isDestroyed ? null : district.ownerPlayerId,
      isOwnedByPlayer: isDestroyed ? false : isOwnedByPlayer,
      heat: isDestroyed ? 0 : district.heat,
      influence: isDestroyed ? 0 : district.influence,
      slotCount: district.slotCount,
      filledSlotCount,
      buildings: isDestroyed ? [] : createDistrictPanelBuildingViews({
        buildings: filledBuildings,
        buildCatalog: input.buildCatalog,
        actionCatalog: input.buildingActionCatalog,
        district,
        playerId: input.playerId,
        playerBalances,
        tick: state.root.tick
      }),
      attackTargets: isDestroyed ? [] : attackTargets,
      spyTargets: isDestroyed ? [] : spyTargets,
      trap: isDestroyed ? null : trap,
      slots: isDestroyed ? [] : Array.from({ length: district.slotCount }, (_value, slotIndex) => {
        var _a2;
        const buildingId = district.buildingIds[slotIndex];
        const building = buildingId ? state.buildingsById[buildingId] : void 0;
        if (building) {
          const productionProfile = input.productionCatalog[building.buildingTypeId];
          const craftProfile = input.craftCatalog[building.buildingTypeId];
          const processingView = createProcessingView(building, craftProfile, state.root.tick);
          const productionState = productionProfile ? state.resourceStatesById[composeEntityId("resource", building.id)] : null;
          const storedAmount = productionProfile ? Math.max(0, Number(((_a2 = productionState == null ? void 0 : productionState.balances) == null ? void 0 : _a2[productionProfile.resourceKey]) || 0)) : 0;
          return {
            slotIndex,
            buildingId: building.id,
            buildingTypeId: building.buildingTypeId,
            status: building.status,
            canBuild: false,
            production: productionProfile ? {
              resourceKey: productionProfile.resourceKey,
              resourceLabel: productionProfile.resourceLabel,
              storedAmount,
              storageCap: productionProfile.storageCap,
              amountPerTick: Math.max(0, Math.floor(productionProfile.amountPerTick * input.productionMultiplier)),
              canCollect: isOwnedByPlayer && building.ownerPlayerId === input.playerId && building.status === "active" && storedAmount > 0,
              collectDisabledReason: !isOwnedByPlayer || building.ownerPlayerId !== input.playerId ? "Only the building owner can collect production here." : building.status !== "active" ? "Only active buildings can collect production." : storedAmount > 0 ? null : `No ${productionProfile.resourceLabel} ready to collect yet.`
            } : null,
            processing: processingView,
            craftOptions: craftProfile ? Object.entries(craftProfile.recipes).map(([recipeId, recipe]) => {
              const missingInputs = Object.entries(recipe.inputCosts).filter(
                ([resourceKey, requiredAmount]) => Math.max(0, Number(playerBalances[resourceKey] || 0)) < requiredAmount
              );
              return {
                recipeId,
                label: recipe.label,
                inputSummary: formatInputSummary(recipe.inputCosts),
                outputResourceKey: recipe.outputResourceKey,
                outputResourceLabel: recipe.outputResourceLabel,
                outputAmount: recipe.outputAmount,
                canCraft: isOwnedByPlayer && building.ownerPlayerId === input.playerId && building.status === "active" && !processingView && missingInputs.length === 0,
                craftDisabledReason: !isOwnedByPlayer || building.ownerPlayerId !== input.playerId ? "Only the building owner can process items here." : building.status !== "active" ? "Only active buildings can process items." : processingView ? `Processing ${processingView.label} completes in ${formatTickLabel(processingView.remainingTicks)}.` : missingInputs.length > 0 ? `Need ${formatInputSummary(Object.fromEntries(missingInputs))}.` : null
              };
            }) : [],
            buildOptions: []
          };
        }
        return {
          slotIndex,
          buildingId: null,
          buildingTypeId: null,
          status: "empty",
          canBuild: false,
          production: null,
          processing: null,
          craftOptions: [],
          buildOptions: []
        };
      })
    };
  };
  const createTrapView = (state, playerId, districtId) => {
    const district = state.districtsById[districtId];
    if (!district || district.ownerPlayerId !== playerId) {
      return null;
    }
    const activeTrap = Object.values(state.trapsById).find(
      (trap) => trap.districtId === district.id && trap.status === "active"
    );
    const otherActiveTrap = Object.values(state.trapsById).find(
      (trap) => trap.ownerPlayerId === playerId && trap.status === "active" && trap.districtId !== district.id
    );
    return {
      enabled: !activeTrap && !otherActiveTrap,
      disabledReason: activeTrap ? `Trap already armed on ${district.name}.` : otherActiveTrap ? "Only one active trap can be armed at a time." : null,
      activeTrap: activeTrap ? {
        trapId: activeTrap.id,
        label: "Hidden trap armed",
        placedAtTick: activeTrap.placedAtTick
      } : null
    };
  };
  const formatInputSummary = (inputCosts) => Object.entries(inputCosts).map(([resourceKey, amount]) => `${amount} ${formatResourceLabel(resourceKey)}`).join(" + ");
  const formatResourceLabel = (resourceKey) => resourceKey.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
  const createProcessingView = (building, craftProfile, tick) => {
    if (!building.processing) {
      return null;
    }
    const recipe = craftProfile == null ? void 0 : craftProfile.recipes[building.processing.recipeId];
    if (!recipe) {
      return null;
    }
    return {
      recipeId: building.processing.recipeId,
      label: recipe.label,
      remainingTicks: Math.max(0, building.processing.completesAtTick - tick),
      totalTicks: Math.max(1, building.processing.completesAtTick - building.processing.startedAtTick),
      outputResourceKey: recipe.outputResourceKey,
      outputResourceLabel: recipe.outputResourceLabel,
      outputAmount: recipe.outputAmount
    };
  };
  const formatTickLabel = (tickCount) => `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;
  const createDistrictSummaryViews = (state, playerId) => state.root.districtIds.map((districtId) => state.districtsById[districtId]).filter((district) => district !== void 0).map((district) => {
    var _a;
    return {
      districtId: district.id,
      name: district.name,
      zone: district.zone,
      ownerPlayerId: district.status === "destroyed" ? null : district.ownerPlayerId,
      ownerColor: district.status === "destroyed" || !district.ownerPlayerId ? null : ((_a = state.playersById[district.ownerPlayerId]) == null ? void 0 : _a.color) ?? null,
      isOwnedByPlayer: district.status === "destroyed" ? false : district.ownerPlayerId === playerId,
      status: district.status,
      adjacentDistrictIds: district.adjacentDistrictIds,
      heat: district.status === "destroyed" ? 0 : district.heat,
      influence: district.status === "destroyed" ? 0 : district.influence,
      filledSlotCount: district.buildingIds.map((buildingId) => state.buildingsById[buildingId]).filter((building) => building !== void 0 && building.status !== "destroyed").length,
      slotCount: district.slotCount
    };
  });
  const createPlayerView = (state, playerId) => {
    var _a;
    const player = state.playersById[playerId];
    const notifications = state.root.notificationIds.map((notificationId) => state.notificationsById[notificationId]).filter((notification) => (notification == null ? void 0 : notification.recipientId) === playerId);
    const victoryState = state.victoryState;
    const resourceBalances = player ? { ...((_a = state.resourceStatesById[player.resourceStateId]) == null ? void 0 : _a.balances) ?? {} } : {};
    return {
      playerId,
      instanceId: state.serverInstance.id,
      mode: state.serverInstance.mode,
      factionId: (player == null ? void 0 : player.factionId) ?? "mafian",
      color: (player == null ? void 0 : player.color) ?? DEFAULT_PLAYER_COLOR,
      serverTime: (/* @__PURE__ */ new Date(0)).toISOString(),
      resourceBalances,
      notifications,
      victoryState
    };
  };
  const writeDiagnosticLog = (replayLogWriter, instanceId, level, category, message, context = {}) => replayLogWriter.writeDiagnostic({
    id: `diag:${instanceId}:${level}:${category}:${Date.now()}`,
    instanceId,
    level,
    category,
    message,
    occurredAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    context
  });
  const createNullLogSink = () => ({
    write: (_entry) => {
      return;
    }
  });
  const createInstanceLogger = (instanceId, sink = createNullLogSink()) => ({
    instanceId,
    info: (message, context) => {
      sink.write({
        level: "info",
        message,
        timestamp: (/* @__PURE__ */ new Date(0)).toISOString(),
        instanceId,
        context
      });
    },
    warn: (message, context) => {
      sink.write({
        level: "warn",
        message,
        timestamp: (/* @__PURE__ */ new Date(0)).toISOString(),
        instanceId,
        context
      });
    },
    error: (message, context) => {
      sink.write({
        level: "error",
        message,
        timestamp: (/* @__PURE__ */ new Date(0)).toISOString(),
        instanceId,
        context
      });
    }
  });
  const restoreOrCreateInitialState = async (snapshotController, instanceId, runtime) => snapshotController.restore(instanceId, runtime);
  const runInstanceTick = (runtime) => {
    if (!runtime.scheduler.isRunning || runtime.scheduler.tickInProgress) {
      return runtime;
    }
    runtime.scheduler.tickInProgress = true;
    runtime.runtimeHealth.lastTickStartedAt = (/* @__PURE__ */ new Date(0)).toISOString();
    try {
      const result = runTick(runtime.state, {
        config: runtime.config
      });
      runtime.state = result.nextState;
      for (const event of result.events) {
        runtime.eventQueue.enqueue(event);
      }
      const tickEvent = {
        type: "tick-completed",
        payload: { tick: runtime.state.root.tick },
        occurredAt: (/* @__PURE__ */ new Date(0)).toISOString()
      };
      runtime.eventQueue.enqueue(tickEvent);
      runtime.eventPublisher.publish(tickEvent);
      runtime.runtimeHealth.lastTickCompletedAt = (/* @__PURE__ */ new Date(0)).toISOString();
      void writeDiagnosticLog(
        runtime.replayLogWriter,
        runtime.record.id,
        "info",
        "tick",
        "Tick completed.",
        {
          tick: runtime.state.root.tick
        }
      );
      return runtime;
    } catch (_error) {
      runtime.record.status = "crashed";
      runtime.record.crashCount += 1;
      runtime.scheduler.isRunning = false;
      runtime.runtimeHealth.lastErrorAt = (/* @__PURE__ */ new Date(0)).toISOString();
      void writeDiagnosticLog(
        runtime.replayLogWriter,
        runtime.record.id,
        "error",
        "crash",
        "Tick execution crashed.",
        {
          tick: runtime.state.root.tick
        }
      );
      return runtime;
    } finally {
      runtime.scheduler.tickInProgress = false;
    }
  };
  class InstanceLifecycleService {
    start(runtime) {
      runtime.record.status = "booting";
      runtime.eventPublisher.publish({
        type: "instance-status-changed",
        payload: { status: runtime.record.status },
        occurredAt: (/* @__PURE__ */ new Date(0)).toISOString()
      });
      runtime = ensureProductionLifecyclePhase(runtime, PRODUCTION_GAME_LIFECYCLE_PHASES.live);
      runtime.record.status = "running";
      runtime.record.startedAt = (/* @__PURE__ */ new Date(0)).toISOString();
      runtime.scheduler.isRunning = true;
      void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "lifecycle", "Instance started.");
      runtime.eventPublisher.publish({
        type: "instance-status-changed",
        payload: { status: runtime.record.status },
        occurredAt: (/* @__PURE__ */ new Date(0)).toISOString()
      });
      return runtime;
    }
    pause(runtime) {
      runtime.record.status = "pausing";
      runtime.scheduler.isRunning = false;
      runtime.eventPublisher.publish({
        type: "instance-status-changed",
        payload: { status: runtime.record.status },
        occurredAt: (/* @__PURE__ */ new Date(0)).toISOString()
      });
      runtime.record.status = "paused";
      void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "lifecycle", "Instance paused.");
      runtime.eventPublisher.publish({
        type: "instance-status-changed",
        payload: { status: runtime.record.status },
        occurredAt: (/* @__PURE__ */ new Date(0)).toISOString()
      });
      return runtime;
    }
    stop(runtime) {
      runtime.record.status = "stopping";
      runtime.record.status = "stopped";
      runtime.record.stoppedAt = (/* @__PURE__ */ new Date(0)).toISOString();
      runtime.scheduler.isRunning = false;
      void runtime.snapshotController.save(runtime);
      void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "snapshot", "Stop triggered snapshot save.");
      runtime.eventPublisher.publish({
        type: "instance-status-changed",
        payload: { status: runtime.record.status },
        occurredAt: (/* @__PURE__ */ new Date(0)).toISOString()
      });
      return runtime;
    }
    restart(runtime) {
      runtime.record.status = "restarting";
      runtime.scheduler.isRunning = false;
      runtime.record.status = "running";
      runtime.scheduler.isRunning = true;
      void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "lifecycle", "Instance restarted.");
      return runtime;
    }
    destroy(runtime) {
      runtime.record.status = "destroying";
      runtime.record.status = "destroyed";
      runtime.scheduler.isRunning = false;
      void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "warn", "lifecycle", "Instance destroyed.");
      runtime.eventPublisher.publish({
        type: "instance-status-changed",
        payload: { status: runtime.record.status },
        occurredAt: (/* @__PURE__ */ new Date(0)).toISOString()
      });
      return runtime;
    }
    tick(runtime) {
      return runInstanceTick(runtime);
    }
    dispatch(runtime, command) {
      void runtime.replayLogWriter.writeCommand({
        id: `cmd:${command.id}`,
        instanceId: runtime.record.id,
        command,
        receivedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
        actorId: command.playerId,
        correlationId: command.clientRequestId,
        tickAtReceive: runtime.state.root.tick
      });
      const result = applyCommand(runtime.state, command, {
        config: runtime.config
      });
      if (result.errors.length > 0) {
        void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "warn", "command", "Command rejected.", {
          commandId: command.id,
          commandType: command.type,
          errorCount: result.errors.length
        });
        return {
          runtime,
          errors: result.errors
        };
      }
      runtime.state = result.nextState;
      const appliedEvent = {
        type: "command-applied",
        payload: {
          commandId: command.id,
          eventCount: result.events.length
        },
        occurredAt: (/* @__PURE__ */ new Date(0)).toISOString()
      };
      runtime.eventQueue.enqueue(appliedEvent);
      runtime.eventPublisher.publish(appliedEvent);
      void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "command", "Command dispatched.", {
        commandId: command.id,
        commandType: command.type
      });
      void runtime.replayLogWriter.writeEvent({
        id: `evt:${command.id}:${runtime.state.root.tick}`,
        instanceId: runtime.record.id,
        event: appliedEvent,
        causedByCommandId: command.id,
        recordedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
        tickAtEmit: runtime.state.root.tick
      });
      return {
        runtime,
        errors: []
      };
    }
    async restore(runtime) {
      runtime.record.status = "booting";
      runtime = await restoreOrCreateInitialState(
        runtime.snapshotController,
        runtime.record.id,
        runtime
      );
      runtime.record.status = "stopped";
      void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "snapshot", "Instance restored from snapshot or initial state.");
      return runtime;
    }
  }
  const ensureProductionLifecyclePhase = (runtime, nextPhase) => {
    if (isDevSetupGameLifecyclePhase(runtime.state.root.phase) || runtime.state.root.phase === nextPhase) {
      return runtime;
    }
    runtime.state.root = {
      ...runtime.state.root,
      phase: nextPhase,
      version: runtime.state.root.version + 1
    };
    return runtime;
  };
  const publicBuildingNameVariants = {
    stock_exchange: ["Vortex Exchange"],
    central_bank: ["Iron Reserve Bank", "Obsidian Central Vault"],
    airport: ["Neon Skyport"],
    lobby_club: ["Velvet Influence Club", "Shadow Lobby Lounge", "Golden Circle Club"],
    city_hall: ["City Dominion Hall", "Urban Control Center"],
    parliament: ["The Vortex Council"],
    port: ["Black Tide Port", "Ironsea Dockyard", "Shadow Harbor"],
    court: ["High Justice Court", "Iron Verdict Hall", "Obsidian Tribunal"],
    vip_lounge: ["Platinum Lounge", "Eclipse VIP Gold Room"],
    mall: ["Neon Mall", "Iron Market Plaza", "Karina shopping center"],
    restaurant: ["Neon Bite", "Black Plate", "Street Fuel", "Blood & Grill", "Midnight Diner", "Iron Taste", "Shadow Kitchen", "Dirty Spoon", "Vice Kitchen", "Urban Hunger", "Smoke & Meat", "The Last Bite", "Gangster Grill", "Concrete Kitchen", "Dark Appetite", "Night Feast", "The Hungry Syndicate", "Rusty Fork", "Back Alley Bistro", "Sinful Kitchen", "Underground Taste", "Savage Kitchen", "Chrome Diner", "Heat Kitchen", "No Mercy Meals", "Broken Plate", "Elite Hunger"],
    pharmacy: ["Neon Medics", "Pulse Pharmacy", "Black Cross Pharma", "Street Remedy", "NightCare Clinic", "Iron Vein Pharmacy", "QuickFix Med", "Shadow Medics", "Urban Cure", "Last Chance Pharmacy"],
    auto_salon: ["Neon Motors", "Iron Wheels Garage", "Blackline Autos", "Street Kings Motors", "Midnight Drive Showroom", "Chrome Syndicate Cars", "Ghost Ride Autos", "Velocity X Garage"],
    fitness_club: ["Iron District Gym", "Beast Factory", "Street Power Club", "No Mercy Fitness"],
    office_block: ["Iron Tower Offices", "Blackline Corporate Hub", "Neon Business Center", "Vortex Office Complex", "Skyline Syndicate Offices", "ShadowCorp Tower"],
    exchange: ["ZeroSum Vault", "Neon Arbitrage", "Phantom Rates", "Cashflow Mirage", "Obsidian Exchange", "Flux Currency Lab", "DeadDrop Finance", "Parallax Exchange", "Ghost Ledger", "Black Circuit Exchange", "Silver Pulse Desk", "Midnight Convertor"],
    arcade: ["Neon Jackpots", "Lucky Circuit", "Black Reel Club", "Midnight Slots", "Spin Syndicate", "Velvet Jackpot Lounge", "Ghost Spin Arcade"],
    casino: ["Dominion Prime Casino", "High Rollers Sanctum", "Velvet Eclipse Casino", "Neon Crown Palace"],
    data_center: ["NeuroGrid Core", "Black Node Nexus", "DataForge Complex", "Synapse Vault", "Quantum Relay Hub", "GhostNet Core", "Iron Pulse Servers", "DeepCode Facility", "CipherStack Center", "Neon Matrix Node"],
    power_station: ["Neon Power Grid", "IronVolt Station", "BlackCore Energy", "Pulse Reactor", "Voltage Nexus", "Dark Energy Hub", "GridLock Station", "Quantum Power Plant", "Overcharge Facility", "ThunderCore Station", "Nova Energy Complex", "Static Surge Plant", "Flux Power Systems", "Obsidian Reactor", "HyperGrid Control"],
    warehouse: ["IronVault Storage", "BlackCrate Depot", "Shadow Storage Hub", "CargoCore Warehouse", "Ghost Stockpile", "SteelBox Depot", "NightStorage Facility", "Hidden Goods Warehouse", "VaultLine Storage", "Obsidian Depot", "DeadDrop Warehouse", "Lockdown Storage", "Backroom Stockpile", "SecureHold Facility", "SteelNest Depot", "GridSafe Storage", "NightCrate Complex", "CargoLock Hub", "SilentVault Depot", "IronGate Warehouse", "DarkReserve Storage"],
    factory: ["IronWorks Factory", "BlackSmoke Industries", "RustCore Plant", "SteelPulse Factory", "GrimeWorks Facility", "DarkForge Industrial", "Vortex Manufacturing", "HeavyGear Plant", "SmokeLine Industries", "Obsidian Production", "Dust & Steel Works", "NightShift Factory", "CoreMechanix Plant", "Ashline Industries", "BruteForce Manufacturing", "IronClad Works", "GritFactory Complex", "SteelHive Plant", "ToxicFlow Industries", "ShadowMachina Works", "HyperSteel Production", "GrindCore Factory", "MassDrive Industries", "DirtyWorks Plant", "Overload Manufacturing"],
    armory: ["Iron Arsenal", "BlackForge Armory", "WarCore Factory", "Steel Reaper Works", "Crimson Armory", "Bullet Syndicate", "Deadshot Industries", "Obsidian Weapons Lab", "Vortex Arms Facility", "Nightfall Armory", "RapidFire Complex", "HellTrigger Works", "Ghost Weapon Systems", "Bloodline Arsenal", "Savage Arms Co.", "Zero Mercy Armory", "Titan Forge Weapons", "DarkSteel Industries", "Recoil Factory", "Phantom Arms Lab", "Iron Rain Arsenal"],
    research_center: ["Neon Research Hub", "IronMind Labs", "Quantum Black Lab", "Synapse Forge Center", "DarkPulse Research", "CipherWorks Institute", "NovaCore Laboratory", "Obsidian Research Vault"],
    recycling_center: ["SteelLoop Recycling", "BlackCycle Depot", "NeoWaste Recovery", "Iron Reclaim Facility", "ScrapCore Center", "Urban Reforge Plant", "DustLine Recycling", "GhostMetal Recovery"],
    brainwash_center: ["NeuroControl Lab", "MindHack Facility", "BlackMind Institute", "Synapse Override Center", "GhostMind Program", "PsyCore Lab", "Oblivion Mind Center", "Neural Dominion Hub", "ThoughtForge Facility", "Cortex Manipulation Lab"],
    apartment_block: Array.from({ length: 36 }, (_, index) => `Blok ${index + 1}`),
    garage: ["Iron Garage", "Street Wheels Hub", "BlackTorque Garage", "Ghost Garage", "NightRide Workshop", "SteelDrive Garage", "BackAlley Garage", "Velocity Garage", "Shadow Wheels"],
    clinic: ["NightCare Clinic", "BlackCross Medical", "PulseFix Clinic", "StreetMed Center", "Iron Health Unit", "GhostCare Facility", "RapidAid Clinic", "ShadowMed Center", "LastHope Clinic", "Urban Recovery"],
    recruitment_center: ["Iron Recruit Hub", "Street Army Center", "BlackFlag Recruitment", "Shadow Enlistment", "Warborn Center", "Ghost Recruit Station", "Bloodline Recruitment", "Urban Soldiers Hub", "Vortex Recruit Base", "Frontline Enlistment", "No Mercy Recruitment"],
    school: ["Street Academy", "Neon Learning Center", "Urban Knowledge Hub", "IronMind School", "Shadow Education", "Vortex Academy", "CoreSkill Institute", "Future Minds School", "BlackBoard Academy", "City Knowledge Center", "BrainCore School", "NextGen Academy", "StreetWise Institute", "LogicLab School"],
    taxi_service: ["NightRide Taxi", "Neon Cab Co.", "GhostDrive Taxi", "StreetMove Transport", "RapidRide Taxi", "Shadow Cab Service", "Urban Wheels Taxi", "BlackRoute Taxi", "Velocity Cab", "Backstreet Taxi", "FlashRide Taxi"],
    drug_lab: ["Neon Chem Lab", "BlackDust Factory", "GhostCook Lab", "Shadow Chemistry", "CrystalForge", "NightBatch Lab", "Toxic Synthesis", "DarkMix Facility", "StreetLab X", "PureRush Lab", "SilentCook Lab"],
    smuggling_tunnel: ["Ghost Tunnel", "BlackRoute Passage", "Shadow Transit", "Silent Tunnel Network", "Underground Flow", "DarkPath Tunnel", "Hidden Route X", "Night Tunnel Line", "Smugglers Vein", "Phantom Passage", "DeepRoute Tunnel", "Backline Tunnel", "ZeroTrace Route", "Iron Tunnel"],
    street_dealers: ["Corner Dealers", "Night Sellers", "Ghost Pushers", "Street Hustlers", "Shadow Dealers", "QuickDrop Crew", "BackAlley Sellers", "Neon Push", "Silent Dealers", "FastCash Crew", "Dirty Hands", "Block Hustlers", "Dark Trade Crew", "Urban Pushers", "NoFace Dealers"],
    strip_club: ["Velvet Nights", "Neon Desire", "Midnight Dolls", "Crimson Lounge", "Silk & Sin", "Shadow Seduction", "Dark Angels Club", "Electric Temptation", "Night Velvet", "Obsidian Desire", "RedLight Palace", "Forbidden Lounge", "Lust District", "Golden Sinners", "Vice Lounge"],
    convenience_store: ["QuickStop Market", "NightMart", "Urban MiniShop", "Street Corner Store", "24/7 Neon Shop", "FastBuy Market", "Backstreet Market", "GhostMart", "QuickPick Store", "City MiniMarket", "FlashMart", "Night Supply", "Urban Grab Shop", "RapidBuy Store", "Street Essentials", "MiniCore Market", "InstantShop", "Shadow Mart", "EasyBuy Corner", "Daily Needs Shop"]
  };
  const h = (hours) => hours * 60 * 60 * 1e3;
  const out = (key, amount) => ({ [key]: amount });
  const a = (actionId, label, description, effectSummary, cooldownHours, heatGain, outputGain = {}, influenceChange = 0, inputCost = {}, durationHours = 0) => ({
    actionId,
    label,
    description,
    effectSummary,
    durationMs: Math.max(1e3, h(durationHours)),
    cooldownMs: h(cooldownHours),
    inputCost,
    outputGain,
    heatGain,
    influenceChange,
    reportText: effectSummary
  });
  const b = (buildingTypeId, label, zone, role, info, stats, specialActions) => ({
    buildingTypeId,
    label,
    nameVariants: publicBuildingNameVariants[buildingTypeId] ?? [],
    zone,
    role,
    info,
    stats,
    specialActions
  });
  const s = (cleanPerHour, dirtyPerHour, heatPerDay, influencePerDay, maxLevel = 5) => ({
    cleanPerHour,
    dirtyPerHour,
    heatPerDay,
    influencePerDay,
    maxLevel
  });
  const publicBuildingDefinitions = [
    b("central_bank", "Centrální banka", "downtown", "Finance", "Hlavní finanční uzel pro clean cash, kontrolu kapitálu a vysoký systémový vliv.", s(1560, 60, 3, 32), [a("central_bank_reserve_audit", "Reserve Audit", "Přesměruje část rezerv do tvého účtu.", "+clean cash, +vliv, +heat", 8, 5, out("cash", 180), 2)]),
    b("city_hall", "Magistrát", "downtown", "Civic control", "Administrativní centrum s vysokým clean income a vlivem nad městskými procesy.", s(1500, 360, 4, 34), [a("city_hall_permit_pressure", "Permit Pressure", "Protlačí povolení a lokální zakázky.", "+clean cash, +vliv, +heat", 8, 4, out("cash", 150), 3)]),
    b("lobby_club", "Lobby klub", "downtown", "Influence", "Diskrétní klub pro kontakty, špinavé finance a politické páky.", s(180, 1320, 6, 38), [a("lobby_club_backroom_deal", "Backroom Deal", "Domluví vlivnou dohodu mimo záznam.", "+dirty cash, +vliv, +heat", 8, 6, out("dirty-cash", 180), 4)]),
    b("stock_exchange", "Burza", "downtown", "Market", "Volatilní kapitál, rychlé přesuny cashflow a finanční riziko.", s(1080, 60, 3, 24), [a("stock_exchange_market_push", "Market Push", "Krátký tržní tlak vytáhne clean cash.", "+clean cash, +heat", 7, 4, out("cash", 140), 1)]),
    b("court", "Soud", "downtown", "Law", "Právní páka pro tlak na území, obranu a politický vliv.", s(1200, 600, 4, 28), [a("court_case_pressure", "Case Pressure", "Využije právní tlak pro vliv v districtu.", "+vliv, +clean cash, +heat", 9, 4, out("cash", 110), 4)]),
    b("vip_lounge", "VIP salonek", "downtown", "Elite", "Elitní zóna pro high-value kontakty, dirty cash a zákulisní dohody.", s(480, 1320, 6, 36), [a("vip_lounge_private_table", "Private Table", "Uzavře soukromý deal s VIP hosty.", "+dirty cash, +vliv, +heat", 10, 7, out("dirty-cash", 220), 3)]),
    b("airport", "Letiště", "downtown", "Logistics", "Vzdušný logistický uzel pro rychlý přesun zboží a lidí.", s(1140, 60, 4, 22), [a("airport_fast_manifest", "Fast Manifest", "Zrychlí přepravní manifest a vytěží cash.", "+clean cash, +materials, +heat", 9, 5, { cash: 130, "metal-parts": 2 }, 1)]),
    b("port", "Přístav", "downtown", "Logistics", "Těžká logistika, kontejnery, materiály a dirty cash přes mořské trasy.", s(1560, 510, 5, 26), [a("port_container_cut", "Container Cut", "Vybere z kontejnerů užitečné zásoby.", "+dirty cash, +materials, +heat", 8, 6, { "dirty-cash": 160, "metal-parts": 3 }, 1)]),
    b("parliament", "Parlament", "downtown", "Power", "Nejvyšší politická páka s extrémním clean income a vlivem.", s(1320, 180, 3, 40), [a("parliament_policy_window", "Policy Window", "Otevře krátké politické okno pro zisk vlivu.", "+vliv, +clean cash, +heat", 12, 5, out("cash", 160), 5)]),
    b("mall", "Obchodní centrum", "commercial", "Retail", "Prémiový retail s vysokým clean cashflow a bezpečným veřejným krytím.", s(480, 60, 2.5, 14), [a("mall_peak_hours", "Peak Hours", "Vytěží dopravní špičku obchodního centra.", "+clean cash, +heat", 6, 3, out("cash", 90), 1)]),
    b("restaurant", "Restaurace", "commercial", "Social", "Safe sociální budova pro kšefty, kontakty a menší district akce.", s(300, 30, 3, 14), [a("restaurant_gang_dinner", "Gang Dinner", "Na chvíli zvedne district income a kontakty.", "+clean cash, +vliv, +heat", 8, 4, out("cash", 80), 2, {}, 2), a("restaurant_street_gossip", "Street Gossip", "Získá lokální drby a vliv.", "+vliv, +heat", 6, 3, {}, 3)]),
    b("arcade", "Herna", "commercial", "Cashflow", "Automaty a hry pro rychlé clean i dirty cashflow.", s(360, 72, 5, 20), [a("arcade_tournament", "Turnaj", "Zvedne příjem herny turnajem.", "+clean cash, +heat", 6, 5, out("cash", 90), 1, {}, 2), a("arcade_laundering", "Praní peněz", "Převede část dirty cash přes hernu.", "+clean cash, -dirty cash, +heat", 7, 4, out("cash", 70), 0, out("dirty-cash", 80))]),
    b("pharmacy", "Lékárna", "commercial", "Production", "Support budova se sloty Chemicals, Biomass a Stim Pack. Vyrobené látky živí Drug Lab a bojové boosty.", s(0, 0, 3, 8, 14), [a("produce_chemicals", "Produce Chemicals", "Vyrobí základní chemikálie.", "+chemicals, +heat", 3e-3, 1, out("chemicals", 6)), a("produce_biomass", "Produce Biomass", "Vyrobí biomasu pro léky a drogy.", "+biomass, +heat", 3e-3, 1, out("biomass", 4)), a("produce_stim_pack", "Produce Stim Pack", "Převede chemicals a biomass na Stim Pack.", "+stim pack, +vliv, +heat", 4e-3, 2, out("stim-pack", 1), 1, { chemicals: 2, biomass: 1 })]),
    b("casino", "Kasino", "commercial", "Laundering", "Vysoké cashflow, praní dirty cash, vliv a risk policejního tlaku.", s(480, 132, 7, 30), [a("launder_dirty_cash", "Launder Dirty Cash", "Pere dirty cash přes kasino.", "+clean cash, -dirty cash, +heat", 5e-3, 2, out("cash", 80), 1, out("dirty-cash", 100)), a("casino_high_stakes", "High Stakes", "Riskantní sázka s okamžitým ziskem.", "+clean cash, +heat", 6, 10, out("cash", 180), 1)]),
    b("auto_salon", "Autosalon", "commercial", "Logistics", "Legální prodeje, šedý dovoz a mobilita flotily.", s(300, 60, 4, 18, 4), [a("auto_salon_premium_offer", "Premium Offer", "Krátce posílí prodej clean cash.", "+clean cash, +heat", 4, 2, out("cash", 95), 1, {}, 2), a("auto_salon_gray_import", "Šedý dovoz", "Přidá dirty cash přes importní kanál.", "+dirty cash, +heat", 6, 5, out("dirty-cash", 130), 1)]),
    b("fitness_club", "Fitness Club", "commercial", "Combat utility", "Bojová utility budova pro ATK/DEF buffy, vliv a district income.", s(260, 160, 4.5, 26), [a("fitness_gang_training", "Trénink gangu", "Dočasný bojový trénink gangu.", "+gang members, +vliv, +heat", 8, 5, out("gang-members", 1), 2, {}, 2), a("fitness_doping", "Doping", "Agresivní bojový boost s pozdějším rizikem.", "+stim pack efekt, +heat", 12, 8, out("stim-pack", 1), 0, {}, 1)]),
    b("exchange", "Směnárna", "commercial", "Finance", "Rychlé finanční operace, clean/dirty cash a menší heat než kasino.", s(330, 78, 3.5, 18), [a("exchange_dirty_to_clean_cash", "Exchange Dirty Cash", "Smění dirty cash na čisté peníze.", "+clean cash, -dirty cash, +heat", 4e-3, 1, out("cash", 45), 0, out("dirty-cash", 50)), a("exchange_quick_liquidity", "Quick Liquidity", "Okamžitě vytáhne clean cash z likvidity.", "+clean cash, +heat", 10, 5, out("cash", 120), 1)]),
    b("office_block", "Kancelářský blok", "commercial", "Corporate", "Korporátní zázemí pro stabilní cash a administrativní krytí.", s(360, 60, 2, 16), [a("office_contract_stack", "Contract Stack", "Vytěží firemní zakázky a kontakty.", "+clean cash, +vliv, +heat", 7, 3, out("cash", 90), 2)]),
    b("apartment_block", "Bytový blok", "residential", "Population", "Personální centrum gangu. Produkuje členy, drží kapacitu a umožňuje náborové akce.", s(90, 30, 3, 10, 4), [a("collect_gang_members", "Collect Gang Members", "Nabere dostupné členy z bytového bloku.", "+gang members, +vliv, +heat", 5e-3, 1, out("gang-members", 2), 1), a("apartment_hidden_housing", "Skryté ubytování", "Spustí ochranný režim za cenu income.", "+vliv, +heat", 8, 3, {}, 2, {}, 2)]),
    b("recruitment_center", "Rekrutační centrum", "residential", "Recruitment", "Cílený nábor a posílení obyvatel pro gang.", s(120, 18, 2, 12, 4), [a("recruitment_drive", "Recruitment Drive", "Získá nové členy gangu.", "+gang members, +heat", 4, 3, out("gang-members", 4), 1)]),
    b("brainwash_center", "Brainwash centrum", "residential", "Loyalty", "Tlak na loajalitu populace, vliv a poslušnost území.", s(480, 90, 4, 22), [a("brainwash_loyalty_push", "Loyalty Push", "Zvedne lokální poslušnost a vliv.", "+vliv, +dirty cash, +heat", 8, 5, out("dirty-cash", 90), 4)]),
    b("garage", "Garage", "residential", "Mobility", "Mobilita gangu, vozidla a krytá logistika.", s(180, 30, 2.5, 10), [a("garage_fast_route", "Fast Route", "Zrychlí lokální přesuny a přinese cash.", "+clean cash, +heat", 5, 3, out("cash", 70), 1)]),
    b("taxi_service", "Taxi služba", "residential", "Mobility", "Nenápadná síť řidičů pro pohyb, informace a menší dirty cash.", s(330, 90, 3, 12), [a("taxi_night_routes", "Night Routes", "Noční jízdy přinesou dirty cash.", "+dirty cash, +heat", 6, 4, out("dirty-cash", 90), 1)]),
    b("clinic", "Klinika", "residential", "Recovery", "Regenerace lidí, krytí zranění a stabilizace území.", s(150, 18, 1.5, 10), [a("clinic_patch_up", "Patch Up", "Vrátí část lidí do akce.", "+gang members, +heat", 5, 2, out("gang-members", 2), 1)]),
    b("school", "Škola", "residential", "Training", "Produkuje členy a umí podpořit Drug Lab přes chemický kurz.", s(264, 60, 2, 16, 4), [a("school_lecture", "Náborová přednáška", "Okamžitě přidá nové členy.", "+gang members, +heat", 3, 2, out("gang-members", 4), 1), a("school_chemistry_course", "Zrychlený kurz chemie", "Podpoří chemickou výrobu v districtu.", "+chemicals, +heat", 4, 3, out("chemicals", 4), 1, {}, 2)]),
    b("factory", "Továrna", "industrial", "Production", "Produkční budova pro Metal Parts, Tech Core a Combat Module.", s(0, 0, 3, 10, 14), [a("produce_metal_parts", "Produce Metal Parts", "Vyrobí kovové díly.", "+metal parts, +heat", 3e-3, 1, out("metal-parts", 5)), a("produce_tech_core", "Produce Tech Core", "Sestaví Tech Core z dílů.", "+tech core, +heat", 5e-3, 2, out("tech-core", 1), 0, out("metal-parts", 2)), a("produce_combat_module", "Produce Combat Module", "Vyrobí Combat Module.", "+combat module, +vliv, +heat", 6e-3, 3, out("combat-module", 1), 1, { "metal-parts": 2, "tech-core": 1 })]),
    b("armory", "Zbrojovka", "industrial", "Weapons", "Vyrábí útočné i obranné vybavení z Metal Parts a Tech Core.", s(0, 0, 4, 18, 14), [a("armory_craft_weapons", "Craft Weapons", "Vyrobí zbraně ze skladových materiálů.", "+combat module, +heat", 6e-3, 3, out("combat-module", 1), 1, { "metal-parts": 2 }), a("armory_fortify", "Fortify District", "Zvedne obrannou připravenost území.", "+vliv, +heat", 8, 4, {}, 3)]),
    b("warehouse", "Sklad", "industrial", "Storage", "Sklad zvyšuje zásoby, materiály a kapacitu produkčních budov.", s(120, 120, 2.8, 14), [a("collect_stored_resources", "Collect Stored Resources", "Vybere uložené resources.", "+chemicals, +metal parts, +dirty cash, +heat", 4e-3, 1, { chemicals: 2, "metal-parts": 2, "dirty-cash": 50 }), a("warehouse_hidden_storage", "Hidden Storage", "Připraví krytý sklad.", "+dirty cash, +vliv, +heat", 10, 4, out("dirty-cash", 90), 2, {}, 3)]),
    b("power_station", "Energetická stanice", "industrial", "Infrastructure", "Napájení produkce a stabilní infrastruktura pro průmysl.", s(240, 18, 2.5, 12), [a("power_station_overclock", "Overclock Grid", "Krátce přetíží grid ve prospěch výroby.", "+tech core, +heat", 8, 5, out("tech-core", 1), 1, {}, 2)]),
    b("data_center", "Datové centrum", "industrial", "Intel", "Datová infrastruktura pro tracking, hacky a cooldown utility.", s(300, 180, 5.5, 32), [a("data_center_tracking", "Player Tracking", "Vytáhne stopu aktivit z dat.", "+vliv, +dirty cash, +heat", 8, 6, out("dirty-cash", 100), 3), a("data_center_data_boost", "Data Boost", "Zrychlí technické operace.", "+tech core, +heat", 12, 8, out("tech-core", 1), 1, {}, 2)]),
    b("research_center", "Výzkumné centrum", "industrial", "Research", "Výzkum optimalizuje produkci, experimenty a technologické upgrady.", s(220, 140, 4.8, 30), [a("research_optimize_production", "Optimalizace výroby", "Zvýší efektivitu produkce.", "+tech core, +heat", 8, 6, out("tech-core", 1), 2, {}, 2), a("research_process_waste", "Zpracování odpadu", "Získá materiály z odpadu.", "+materials, +heat", 6, 3, { chemicals: 2, "metal-parts": 2 }, 1)]),
    b("recycling_center", "Recyklační centrum", "industrial", "Recovery", "Obnova zdrojů, rozklad zásilek a materiálová záchrana.", s(170, 130, 4, 16), [a("recycling_break_shipment", "Break Shipment", "Rozebere zásilku na použitelné materiály.", "+chemicals, +metal parts, +heat", 8, 5, { chemicals: 2, "metal-parts": 5 }, 1)]),
    b("drug_lab", "Drug Lab", "park", "Drug production", "Core produkční budova pro Neon Dust, Pulse Shot a Velvet Smoke. Produkce generuje heat a zásoby drog.", s(0, 0, 6, 20, 14), [a("produce_neon_dust", "Produce Neon Dust", "Syntetizuje Neon Dust.", "+neon dust, +vliv, +heat", 4e-3, 3, out("neon-dust", 2), 1, out("chemicals", 1)), a("produce_pulse_shot", "Produce Pulse Shot", "Uvaří Pulse Shot.", "+pulse shot, +vliv, +heat", 4e-3, 3, out("pulse-shot", 1), 1, { chemicals: 2, biomass: 1 }), a("produce_velvet_smoke", "Produce Velvet Smoke", "Vyrobí Velvet Smoke.", "+velvet smoke, +vliv, +heat", 4e-3, 2, out("velvet-smoke", 2), 1, out("biomass", 2))]),
    b("smuggling_tunnel", "Pašovací tunel", "park", "Smuggling", "Skrytý logistický koridor pro dirty cash, drogy a park income.", s(100, 260, 4.3, 18), [a("smuggling_big_shipment", "Big Shipment", "Protlačí větší zásilku přes tunel.", "+dirty cash, +drugs, +heat", 8, 10, { "dirty-cash": 150, "neon-dust": 2 }, 1)]),
    b("convenience_store", "Večerka", "park", "Cover shop", "Malý obchod, co nikdy nezavírá. Přes den normální kšeft, v noci jiný byznys.", s(210, 78, 2.5, 8), [a("convenience_night_sale", "Noční prodej", "Noční provoz posílí income.", "+cash, +heat", 6, 3, out("cash", 60), 1, {}, 4), a("convenience_small_deal", "Malý deal", "Rychlý prodej Neon Dust.", "+dirty cash, +heat", 7, 4, out("dirty-cash", 90))]),
    b("strip_club", "Strip club", "park", "Nightlife", "Noční podnik s dirty cash, vlivem a kontakty.", s(220, 200, 5, 28), [a("strip_club_vip_night", "VIP Night", "VIP noc zvýší příjmy a kontakty.", "+dirty cash, +vliv, +heat", 6, 6, out("dirty-cash", 140), 3, {}, 2)]),
    b("street_dealers", "Pouliční dealeři", "park", "Distribution", "Pouliční distribuční síť pro drogy, dirty cash a lokální heat.", s(6, 270, 7, 3.5), [a("street_dealers_aggressive_push", "Aggressive Push", "Agresivní pouliční prodej.", "+dirty cash, +heat", 6, 8, out("dirty-cash", 130), 1, {}, 1)])
  ];
  const getAllPublicBuildingDefinitions = () => publicBuildingDefinitions.map((definition) => ({
    ...definition,
    nameVariants: [...definition.nameVariants],
    stats: { ...definition.stats },
    specialActions: definition.specialActions.map((action) => ({
      ...action,
      inputCost: { ...action.inputCost },
      outputGain: { ...action.outputGain }
    }))
  }));
  const baseBuildingActionsConfig = Object.fromEntries(
    getAllPublicBuildingDefinitions().flatMap(
      (definition) => definition.specialActions.map((action) => [
        action.actionId,
        {
          actionId: action.actionId,
          buildingType: definition.buildingTypeId,
          label: action.label,
          description: action.description,
          durationMs: action.durationMs,
          cooldownMs: action.cooldownMs,
          inputCost: { ...action.inputCost },
          outputGain: { ...action.outputGain },
          heatGain: action.heatGain,
          influenceChange: action.influenceChange,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: action.reportText
        }
      ])
    )
  );
  const baseBalanceConfig = {
    incomeMultiplier: 1,
    productionMultiplier: 1,
    cooldownMultiplier: 1,
    maxPlayersPerServer: 100,
    maxAllianceSize: 10,
    buildSlotLimit: 6,
    eventFrequencyMultiplier: 1,
    policePressureMultiplier: 1,
    raidIntensityMultiplier: 1,
    expansionSpeedMultiplier: 1,
    dayLengthTicks: 12,
    nightLengthTicks: 12,
    victoryConditionKey: "default-control",
    startingResources: {
      cash: 1e3,
      "dirty-cash": 250,
      chemicals: 10,
      biomass: 6,
      "metal-parts": 8,
      "tech-core": 2
    },
    conflict: {
      spyCooldownTicks: 2,
      attackCooldownTicks: 2,
      spyBaseSuccessChance: 0.72,
      spyTrapRevealChance: 0.22,
      trapAttackLosses: 1,
      reportsLimit: 6,
      catastropheChance: 0.08
    },
    productionBuildings: {
      pharmacy: {
        resourceKey: "chemicals",
        resourceLabel: "Chemicals",
        amountPerTick: 5,
        storageCap: 25
      },
      factory: {
        resourceKey: "metal-parts",
        resourceLabel: "Metal Parts",
        amountPerTick: 4,
        storageCap: 24
      },
      drug_lab: {
        resourceKey: "neon-dust",
        resourceLabel: "Neon Dust",
        amountPerTick: 2,
        storageCap: 18
      }
    },
    craftBuildings: {
      pharmacy: {
        recipes: {
          "stim-pack": {
            label: "Stim Pack",
            durationTicks: 2,
            inputCosts: {
              chemicals: 6
            },
            outputResourceKey: "stim-pack",
            outputResourceLabel: "Stim Pack",
            outputAmount: 1
          }
        }
      },
      factory: {
        recipes: {
          "tech-core": {
            label: "Tech Core",
            durationTicks: 2,
            inputCosts: {
              "metal-parts": 4
            },
            outputResourceKey: "tech-core",
            outputResourceLabel: "Tech Core",
            outputAmount: 1
          },
          "combat-module": {
            label: "Combat Module",
            durationTicks: 3,
            inputCosts: {
              "metal-parts": 4,
              "tech-core": 2
            },
            outputResourceKey: "combat-module",
            outputResourceLabel: "Combat Module",
            outputAmount: 1
          }
        }
      },
      drug_lab: {
        recipes: {
          "pulse-shot": {
            label: "Pulse Shot",
            durationTicks: 2,
            inputCosts: {
              chemicals: 2,
              biomass: 1
            },
            outputResourceKey: "pulse-shot",
            outputResourceLabel: "Pulse Shot",
            outputAmount: 1
          },
          "velvet-smoke": {
            label: "Velvet Smoke",
            durationTicks: 2,
            inputCosts: {
              biomass: 2,
              chemicals: 1
            },
            outputResourceKey: "velvet-smoke",
            outputResourceLabel: "Velvet Smoke",
            outputAmount: 2
          },
          "ghost-serum": {
            label: "Ghost Serum",
            durationTicks: 3,
            inputCosts: {
              chemicals: 2,
              biomass: 1,
              "stim-pack": 1
            },
            outputResourceKey: "ghost-serum",
            outputResourceLabel: "Ghost Serum",
            outputAmount: 1
          },
          "overdrive-x": {
            label: "Overdrive X",
            durationTicks: 4,
            inputCosts: {
              chemicals: 3,
              biomass: 2,
              "stim-pack": 2
            },
            outputResourceKey: "overdrive-x",
            outputResourceLabel: "Overdrive X",
            outputAmount: 1
          }
        }
      },
      armory: {
        recipes: {
          pistol: {
            label: "Pistol",
            durationTicks: 2,
            inputCosts: {
              "metal-parts": 3,
              "tech-core": 1
            },
            outputResourceKey: "pistol",
            outputResourceLabel: "Pistol",
            outputAmount: 2
          },
          smg: {
            label: "SMG",
            durationTicks: 3,
            inputCosts: {
              "metal-parts": 5,
              "tech-core": 2
            },
            outputResourceKey: "smg",
            outputResourceLabel: "SMG",
            outputAmount: 1
          },
          vest: {
            label: "Vest",
            durationTicks: 2,
            inputCosts: {
              "metal-parts": 3,
              "tech-core": 1
            },
            outputResourceKey: "vest",
            outputResourceLabel: "Vest",
            outputAmount: 2
          },
          barricades: {
            label: "Barricades",
            durationTicks: 2,
            inputCosts: {
              "metal-parts": 4
            },
            outputResourceKey: "barricades",
            outputResourceLabel: "Barricades",
            outputAmount: 2
          },
          alarm: {
            label: "Alarm",
            durationTicks: 2,
            inputCosts: {
              "metal-parts": 2,
              "tech-core": 1
            },
            outputResourceKey: "alarm",
            outputResourceLabel: "Alarm",
            outputAmount: 1
          }
        }
      }
    },
    buildingActions: baseBuildingActionsConfig
  };
  const basePublicModeConfig = {
    mode: "free",
    label: "Empire Streets",
    matchStyle: "short",
    tickRateMs: 5e3,
    sessionKeyPrefix: "empire:base"
  };
  const baseTechnicalConfig = {
    sessionTtlMs: 1e3 * 60 * 60 * 12,
    gameDurationMs: 1e3 * 60 * 60 * 24,
    storageKeyPrefix: "empire:base",
    snapshotIntervalTicks: 10,
    notificationBatchWindowMs: 250,
    debug: {
      allowDebugTools: false,
      enableDeterministicSeeds: false
    }
  };
  const baseResolvedGameModeConfig = {
    mode: "free",
    tickRateMs: 5e3,
    balance: baseBalanceConfig,
    technical: baseTechnicalConfig,
    publicMeta: basePublicModeConfig
  };
  const freeModeOverride = {
    mode: "free",
    tickRateMs: 5e3,
    balance: {
      incomeMultiplier: 1.2,
      productionMultiplier: 1.2,
      cooldownMultiplier: 0.8,
      maxPlayersPerServer: 80,
      maxAllianceSize: 6,
      buildSlotLimit: 8,
      eventFrequencyMultiplier: 1.2,
      policePressureMultiplier: 0.9,
      raidIntensityMultiplier: 0.9,
      expansionSpeedMultiplier: 1.3,
      dayLengthTicks: 8,
      nightLengthTicks: 8,
      victoryConditionKey: "fast-control",
      startingResources: {
        cash: 1500,
        "dirty-cash": 300,
        chemicals: 10,
        biomass: 6,
        "metal-parts": 8,
        "tech-core": 2
      }
    },
    technical: {
      sessionTtlMs: 1e3 * 60 * 60 * 6,
      gameDurationMs: 1e3 * 60 * 60 * 12,
      storageKeyPrefix: "empire:free",
      snapshotIntervalTicks: 8,
      notificationBatchWindowMs: 200,
      debug: {
        allowDebugTools: false,
        enableDeterministicSeeds: false
      }
    },
    publicMeta: {
      mode: "free",
      label: "Empire Streets Free",
      matchStyle: "short",
      tickRateMs: 5e3,
      sessionKeyPrefix: "empire:free"
    }
  };
  const mergeModeConfig = (base, override) => {
    var _a;
    return {
      ...base,
      ...override,
      balance: {
        ...base.balance,
        ...override.balance
      },
      technical: {
        ...base.technical,
        ...override.technical,
        debug: {
          ...base.technical.debug,
          ...(_a = override.technical) == null ? void 0 : _a.debug
        }
      },
      publicMeta: {
        ...base.publicMeta,
        ...override.publicMeta
      }
    };
  };
  const createFreeModeConfig = () => mergeModeConfig(baseResolvedGameModeConfig, freeModeOverride);
  const warModeOverride = {
    mode: "war",
    tickRateMs: 15e3,
    balance: {
      incomeMultiplier: 1,
      productionMultiplier: 1,
      cooldownMultiplier: 1.15,
      maxPlayersPerServer: 150,
      maxAllianceSize: 12,
      buildSlotLimit: 8,
      eventFrequencyMultiplier: 0.9,
      policePressureMultiplier: 1.1,
      raidIntensityMultiplier: 1.15,
      expansionSpeedMultiplier: 0.85,
      dayLengthTicks: 16,
      nightLengthTicks: 16,
      victoryConditionKey: "long-war-control",
      startingResources: {
        cash: 1e3,
        "dirty-cash": 250,
        chemicals: 8,
        biomass: 5,
        "metal-parts": 8,
        "tech-core": 1
      }
    },
    technical: {
      sessionTtlMs: 1e3 * 60 * 60 * 24,
      gameDurationMs: 1e3 * 60 * 60 * 24 * 7,
      storageKeyPrefix: "empire:war",
      snapshotIntervalTicks: 12,
      notificationBatchWindowMs: 400,
      debug: {
        allowDebugTools: false,
        enableDeterministicSeeds: false
      }
    },
    publicMeta: {
      mode: "war",
      label: "Empire Streets War",
      matchStyle: "long",
      tickRateMs: 15e3,
      sessionKeyPrefix: "empire:war"
    }
  };
  const createWarModeConfig = () => mergeModeConfig(baseResolvedGameModeConfig, warModeOverride);
  const deepFreezeConfig = (value) => {
    if (value && typeof value === "object") {
      Object.freeze(value);
      for (const child of Object.values(value)) {
        if (child && typeof child === "object" && !Object.isFrozen(child)) {
          deepFreezeConfig(child);
        }
      }
    }
    return value;
  };
  const validateModeConfig = (config) => {
    if (config.tickRateMs <= 0) {
      throw new Error("Mode config requires a positive tickRateMs.");
    }
    if (config.balance.maxPlayersPerServer <= 0) {
      throw new Error("Mode config requires a positive maxPlayersPerServer.");
    }
    if (config.balance.maxAllianceSize <= 0) {
      throw new Error("Mode config requires a positive maxAllianceSize.");
    }
    if (!config.technical.storageKeyPrefix) {
      throw new Error("Mode config requires a storageKeyPrefix.");
    }
    if (config.balance.conflict) {
      if (config.balance.conflict.spyCooldownTicks < 0) {
        throw new Error("Conflict config requires a non-negative spyCooldownTicks.");
      }
      if (config.balance.conflict.attackCooldownTicks < 0) {
        throw new Error("Conflict config requires a non-negative attackCooldownTicks.");
      }
      if (config.balance.conflict.trapAttackLosses < 0) {
        throw new Error("Conflict config requires a non-negative trapAttackLosses.");
      }
      if (config.balance.conflict.reportsLimit <= 0) {
        throw new Error("Conflict config requires a positive reportsLimit.");
      }
      for (const [key, value] of [
        ["spyBaseSuccessChance", config.balance.conflict.spyBaseSuccessChance],
        ["spyTrapRevealChance", config.balance.conflict.spyTrapRevealChance]
      ]) {
        if (value < 0 || value > 1) {
          throw new Error(`Conflict config requires ${key} between 0 and 1.`);
        }
      }
    }
    for (const craftBuilding of Object.values(config.balance.craftBuildings ?? {})) {
      for (const recipe of Object.values(craftBuilding.recipes)) {
        if (recipe.durationTicks <= 0) {
          throw new Error(`Craft recipe "${recipe.label}" requires a positive durationTicks.`);
        }
      }
    }
    for (const action of Object.values(config.balance.buildingActions ?? {})) {
      if (!action.actionId || !action.buildingType) {
        throw new Error("Building action config requires actionId and buildingType.");
      }
      if (action.durationMs <= 0 || action.cooldownMs < 0) {
        throw new Error(`Building action "${action.actionId}" requires positive durationMs and non-negative cooldownMs.`);
      }
      if (action.heatGain < 0) {
        throw new Error(`Building action "${action.actionId}" requires non-negative heatGain.`);
      }
    }
    return config;
  };
  const resolveModeConfig = (mode) => {
    const registry = {
      free: createFreeModeConfig,
      war: createWarModeConfig
    };
    return deepFreezeConfig(validateModeConfig(registry[mode]()));
  };
  const getPublicBuildingCatalog = (_mode) => getAllPublicBuildingDefinitions();
  const set = (zone, tier, key, title, buildingTypes) => ({ key, zone, tier, title, buildingTypes });
  const publicDistrictBuildingSetPools = {
    commercial: [
      set("commercial", "early", "early-stable-1", "Stabilní provoz", ["restaurant", "fitness_club"]),
      set("commercial", "early", "early-stable-2", "Civilní utility", ["restaurant", "pharmacy"]),
      set("commercial", "early", "early-cash", "Lehký cashflow", ["restaurant", "exchange"]),
      set("commercial", "early", "early-safe-3", "Bezpečný mix", ["restaurant", "pharmacy", "fitness_club"]),
      set("commercial", "early", "early-launder", "Startovní laundering", ["auto_salon", "restaurant"]),
      set("commercial", "mid", "mid-balance-1", "Utility growth", ["auto_salon", "pharmacy"]),
      set("commercial", "mid", "mid-balance-2", "Finanční uzel", ["auto_salon", "exchange"]),
      set("commercial", "mid", "mid-corp-1", "Korporátní stabilita", ["office_block", "restaurant"]),
      set("commercial", "mid", "mid-corp-2", "Administrativní utility", ["office_block", "pharmacy", "restaurant"]),
      set("commercial", "mid", "mid-mall-1", "Hlavní retail", ["mall", "restaurant"]),
      set("commercial", "mid", "mid-mix-1", "Vyvážený obchod", ["restaurant", "pharmacy", "exchange"]),
      set("commercial", "mid", "mid-mix-2", "Prací front", ["auto_salon", "exchange", "restaurant"]),
      set("commercial", "top", "top-casino-1", "Kasino hotspot", ["casino", "restaurant"]),
      set("commercial", "top", "top-casino-2", "Shady premium", ["casino", "restaurant", "pharmacy"]),
      set("commercial", "top", "top-casino-3", "Black cash engine", ["casino", "exchange", "auto_salon"]),
      set("commercial", "top", "top-mall-1", "Prémiový retail", ["mall", "pharmacy", "restaurant"]),
      set("commercial", "top", "top-mall-2", "Financial boulevard", ["mall", "exchange", "restaurant"])
    ],
    residential: [
      set("residential", "early", "res-early-1", "Startovní růst", ["apartment_block", "garage"]),
      set("residential", "early", "res-early-2", "Stabilní základna", ["apartment_block", "brainwash_center"]),
      set("residential", "early", "res-early-3", "První nábor", ["apartment_block", "recruitment_center"]),
      set("residential", "early", "res-early-4", "Obytná kontrola", ["apartment_block", "brainwash_center", "garage"]),
      set("residential", "mid", "res-mid-1", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
      set("residential", "mid", "res-mid-2", "Udržitelný růst", ["apartment_block", "clinic"]),
      set("residential", "mid", "res-mid-3", "Disciplína a kvalita", ["apartment_block", "school"]),
      set("residential", "mid", "res-mid-4", "Loajalita a výcvik", ["brainwash_center", "school"]),
      set("residential", "mid", "res-mid-5", "Regenerace fronty", ["recruitment_center", "clinic"]),
      set("residential", "mid", "res-mid-6", "Kontrolovaný development", ["apartment_block", "brainwash_center", "school"]),
      set("residential", "late", "res-late-1", "Válečné zázemí", ["apartment_block", "recruitment_center", "clinic"]),
      set("residential", "late", "res-late-2", "Mobilní tlak", ["recruitment_center", "garage", "clinic"]),
      set("residential", "late", "res-late-3", "Loajální populace", ["apartment_block", "brainwash_center", "clinic"]),
      set("residential", "late", "res-late-4", "Elitní rezidenční zóna", ["apartment_block", "school", "clinic"]),
      set("residential", "late", "res-late-5", "Strategická mobilizace", ["apartment_block", "recruitment_center", "school"])
    ],
    park: [
      set("park", "early", "park-early-1", "Street cash", ["street_dealers", "convenience_store"]),
      set("park", "early", "park-early-2", "Quick runners", ["street_dealers", "smuggling_tunnel"]),
      set("park", "early", "park-early-3", "Night cover", ["strip_club", "convenience_store"]),
      set("park", "mid", "park-mid-1", "Distribution lane", ["drug_lab", "smuggling_tunnel"]),
      set("park", "mid", "park-mid-2", "Vice market", ["strip_club", "street_dealers"]),
      set("park", "mid", "park-mid-3", "Covered traffic", ["smuggling_tunnel", "convenience_store"]),
      set("park", "mid", "park-mid-4", "Hidden production", ["drug_lab", "convenience_store"]),
      set("park", "mid", "park-mid-5", "Night logistics", ["strip_club", "smuggling_tunnel"]),
      set("park", "top", "park-top-1", "Chaos corridor", ["drug_lab", "smuggling_tunnel", "street_dealers"]),
      set("park", "top", "park-top-2", "Vice empire", ["drug_lab", "strip_club"]),
      set("park", "top", "park-top-3", "Black nightlife", ["strip_club", "street_dealers", "convenience_store"]),
      set("park", "top", "park-top-4", "Hot route", ["drug_lab", "smuggling_tunnel", "convenience_store"])
    ],
    industrial: [
      set("industrial", "early", "ind-early-1", "Základní výroba", ["factory", "warehouse"]),
      set("industrial", "early", "ind-early-2", "Napájená produkce", ["factory", "power_station"]),
      set("industrial", "early", "ind-early-3", "První militarizace", ["factory", "armory"]),
      set("industrial", "early", "ind-early-4", "Zásobovací uzel", ["warehouse", "power_station"]),
      set("industrial", "early", "ind-early-5", "Základní výzkum", ["factory", "research_center"]),
      set("industrial", "early", "ind-early-6", "Recyklační tok", ["warehouse", "recycling_center"]),
      set("industrial", "mid", "ind-mid-1", "Vojenská výroba", ["armory", "warehouse"]),
      set("industrial", "mid", "ind-mid-2", "Technický provoz", ["factory", "data_center"]),
      set("industrial", "mid", "ind-mid-3", "Efektivní řetězec", ["factory", "warehouse", "power_station"]),
      set("industrial", "mid", "ind-mid-4", "Zbrojní logistika", ["armory", "warehouse", "power_station"]),
      set("industrial", "mid", "ind-mid-5", "Datová výroba", ["warehouse", "data_center"]),
      set("industrial", "mid", "ind-mid-6", "Výzkum a obrana", ["research_center", "armory"]),
      set("industrial", "mid", "ind-mid-7", "Obnova zdrojů", ["factory", "recycling_center", "warehouse"]),
      set("industrial", "top", "ind-top-1", "Arms grid", ["factory", "armory", "warehouse"]),
      set("industrial", "top", "ind-top-2", "Power forge", ["factory", "armory", "power_station"]),
      set("industrial", "top", "ind-top-3", "Hack foundry", ["armory", "data_center", "warehouse"]),
      set("industrial", "top", "ind-top-4", "Critical infrastructure", ["power_station", "data_center", "warehouse"]),
      set("industrial", "top", "ind-top-5", "War research nexus", ["armory", "research_center", "data_center"]),
      set("industrial", "top", "ind-top-6", "Circular war industry", ["armory", "recycling_center", "factory"])
    ],
    downtown: [
      set("downtown", "mid", "down-mid-1", "Městské finance", ["central_bank", "city_hall"]),
      set("downtown", "mid", "down-mid-2", "Politický vliv", ["lobby_club", "city_hall"]),
      set("downtown", "mid", "down-mid-3", "Právní tlak", ["court", "lobby_club"]),
      set("downtown", "mid", "down-mid-4", "Volatilní kapitál", ["stock_exchange", "vip_lounge"]),
      set("downtown", "high", "down-high-1", "Korporátní kontrola", ["central_bank", "lobby_club"]),
      set("downtown", "high", "down-high-2", "Státní pevnost", ["city_hall", "court"]),
      set("downtown", "high", "down-high-3", "Elitní arbitráž", ["court", "vip_lounge"]),
      set("downtown", "high", "down-high-4", "Burzovní manipulace", ["stock_exchange", "lobby_club"]),
      set("downtown", "high", "down-high-5", "Executive chamber", ["city_hall", "vip_lounge"]),
      set("downtown", "core", "down-core-1", "Capital nexus", ["central_bank", "city_hall", "vip_lounge"]),
      set("downtown", "core", "down-core-2", "Shadow exchange", ["stock_exchange", "lobby_club", "vip_lounge"]),
      set("downtown", "core", "down-core-3", "Judicial machine", ["city_hall", "court", "lobby_club"]),
      set("downtown", "core", "down-core-4", "System override", ["central_bank", "court", "lobby_club"])
    ]
  };
  const tierOrderByZone = {
    commercial: ["early", "mid", "top"],
    residential: ["early", "mid", "late"],
    park: ["early", "mid", "top"],
    industrial: ["early", "mid", "top"],
    downtown: ["mid", "high", "core"]
  };
  const normalizedLabelToTypeId = Object.fromEntries(
    publicBuildingDefinitions.flatMap((definition) => [
      [normalizeBuildingName(definition.label), definition.buildingTypeId],
      [normalizeBuildingName(definition.buildingTypeId), definition.buildingTypeId]
    ])
  );
  const getBuildingTypeIdForLegacyName = (name) => normalizedLabelToTypeId[normalizeBuildingName(name)] ?? null;
  const getBuildingTypesForLegacyNames = (names) => {
    const buildingTypes = (Array.isArray(names) ? names : []).map((name) => getBuildingTypeIdForLegacyName(String(name || ""))).filter((buildingType) => Boolean(buildingType));
    return Array.from(new Set(buildingTypes));
  };
  const resolveDistrictBuildingSet = (input) => {
    const zone = normalizeZone(input.zone);
    const pool = publicDistrictBuildingSetPools[zone] ?? [];
    if (pool.length < 1) {
      return null;
    }
    const directSet = input.buildingSetKey ? pool.find((candidate) => candidate.key === input.buildingSetKey) : null;
    if (directSet) {
      return directSet;
    }
    const tier = resolveDistrictTier(zone, input.districtId, input.buildingTier);
    const tierPool = pool.filter((candidate) => candidate.tier === tier);
    const candidates = tierPool.length > 0 ? tierPool : pool;
    return candidates[hashDistrictSeed(input.districtId) % candidates.length] ?? null;
  };
  const resolveDistrictBuildingTypes = (input) => {
    var _a;
    const legacyBuildingTypes = getBuildingTypesForLegacyNames(input.legacyBuildingNames);
    if (legacyBuildingTypes.length > 0) {
      return legacyBuildingTypes;
    }
    return ((_a = resolveDistrictBuildingSet(input)) == null ? void 0 : _a.buildingTypes) ?? [];
  };
  const resolveDistrictTier = (zone, districtId, explicitTier) => {
    const orderedTiers = tierOrderByZone[zone] ?? ["early", "mid", "top"];
    const normalizedTier = String(explicitTier || "").trim().toLowerCase();
    if (orderedTiers.includes(normalizedTier)) {
      return normalizedTier;
    }
    const bucket = hashDistrictSeed(districtId) % 100;
    if (bucket < 40) return orderedTiers[0] ?? "early";
    if (bucket >= 75) return orderedTiers[2] ?? orderedTiers[0] ?? "top";
    return orderedTiers[1] ?? orderedTiers[0] ?? "mid";
  };
  const normalizeZone = (zone) => {
    const normalized = String(zone || "").trim().toLowerCase();
    return publicDistrictBuildingSetPools[normalized] ? normalized : "residential";
  };
  function normalizeBuildingName(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  }
  const hashDistrictSeed = (seed) => {
    const text = String(seed || "");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = hash * 31 + text.charCodeAt(index) >>> 0;
    }
    return hash;
  };
  const toPublicModeConfig = (config) => config.publicMeta;
  const createNullInstanceEventPublisher = () => ({
    publish: (_event) => {
      return;
    }
  });
  class InstanceEventQueue {
    constructor() {
      __publicField(this, "events", []);
    }
    enqueue(event) {
      this.events.push(event);
    }
    drain() {
      return this.events.splice(0, this.events.length);
    }
    size() {
      return this.events.length;
    }
  }
  const createNullCommandLogRepository = () => ({
    append: async (_record) => {
      return;
    },
    listByInstance: async (_instanceId) => []
  });
  const createNullDiagnosticLogRepository = () => ({
    append: async (_record) => {
      return;
    },
    listByInstance: async (_instanceId) => []
  });
  const createNullEventLogRepository = () => ({
    append: async (_record) => {
      return;
    },
    listByInstance: async (_instanceId) => []
  });
  const createReplayLogWriter = (commandLogRepository, eventLogRepository, diagnosticLogRepository) => ({
    writeCommand: async (record) => commandLogRepository.append(record),
    writeEvent: async (record) => eventLogRepository.append(record),
    writeDiagnostic: async (record) => diagnosticLogRepository.append(record)
  });
  const createInstanceScheduler = (tickRateMs) => ({
    tickRateMs,
    isRunning: false,
    tickInProgress: false
  });
  const createNullSnapshotRepository = () => ({
    save: async (_snapshot) => {
      return;
    },
    loadLatest: async (_instanceId) => null
  });
  const createInstanceSnapshot = (runtime) => ({
    snapshotId: `snapshot:${runtime.record.id}:${runtime.state.root.tick}`,
    instanceId: runtime.record.id,
    createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    tick: runtime.state.root.tick,
    mode: runtime.record.mode,
    metadata: {
      instanceId: runtime.record.id,
      mode: runtime.record.mode,
      configKey: runtime.record.configKey,
      status: runtime.record.status,
      createdAt: runtime.record.createdAt,
      startedAt: runtime.record.startedAt,
      stoppedAt: runtime.record.stoppedAt,
      crashCount: runtime.record.crashCount,
      lastCrashAt: runtime.runtimeHealth.lastErrorAt,
      version: runtime.record.version
    },
    version: {
      schemaVersion: 1,
      coreVersion: "1",
      configVersion: runtime.config.mode
    },
    integrity: {
      entityCounts: {
        players: Object.keys(runtime.state.playersById).length,
        alliances: Object.keys(runtime.state.alliancesById).length,
        districts: Object.keys(runtime.state.districtsById).length,
        buildings: Object.keys(runtime.state.buildingsById).length
      },
      rootVersion: runtime.state.root.version
    },
    state: runtime.state
  });
  const restoreInstanceState = (snapshot) => snapshot.state;
  const createPersistenceRestoreService = (snapshotRepository) => ({
    restore: async (runtime) => {
      const snapshot = await snapshotRepository.loadLatest(runtime.record.id);
      runtime.state = snapshot ? restoreInstanceState(snapshot) : createInitialState(runtime.record.id, runtime.record.mode);
      return runtime;
    }
  });
  const createInstanceSnapshotService = (snapshotRepository) => ({
    save: async (runtime) => {
      const snapshot = createInstanceSnapshot(runtime);
      await snapshotRepository.save(snapshot);
    }
  });
  const createGameStateRepository = (snapshotRepository = createNullSnapshotRepository()) => {
    const snapshotService = createInstanceSnapshotService(snapshotRepository);
    const restoreService = createPersistenceRestoreService(snapshotRepository);
    return {
      loadLatest: async (_instanceId, runtime) => restoreService.restore(runtime),
      saveLatest: async (runtime) => snapshotService.save(runtime)
    };
  };
  const createNullGameStateRepository = () => createGameStateRepository(createNullSnapshotRepository());
  const createSnapshotController = (repository) => ({
    save: async (runtime) => repository.saveLatest(runtime),
    restore: async (instanceId, runtime) => repository.loadLatest(instanceId, runtime)
  });
  const createServerInstanceRuntime = (instanceId, mode) => {
    const config = resolveModeConfig(mode);
    const state = createInitialState(instanceId, mode);
    const eventQueue = new InstanceEventQueue();
    const eventPublisher = createNullInstanceEventPublisher();
    const runtimeHealth = {
      lastErrorAt: null,
      lastTickStartedAt: null,
      lastTickCompletedAt: null
    };
    const logger = createInstanceLogger(instanceId);
    const replayLogWriter = createReplayLogWriter(
      createNullCommandLogRepository(),
      createNullEventLogRepository(),
      createNullDiagnosticLogRepository()
    );
    const scheduler = createInstanceScheduler(config.tickRateMs);
    const snapshotController = createSnapshotController(createNullGameStateRepository());
    const runtime = {
      record: {
        id: instanceId,
        mode,
        configKey: mode,
        status: "created",
        createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
        startedAt: null,
        stoppedAt: null,
        crashCount: 0,
        version: 1
      },
      config,
      state,
      eventQueue,
      eventPublisher,
      runtimeHealth,
      logger,
      replayLogWriter,
      scheduler,
      snapshotController
    };
    createInstanceMonitorSnapshot(runtime.record, runtime.state, runtime.eventQueue, runtime.runtimeHealth);
    return runtime;
  };
  class InstanceRegistry {
    constructor() {
      __publicField(this, "runtimes", /* @__PURE__ */ new Map());
    }
    set(runtime) {
      this.runtimes.set(runtime.record.id, runtime);
    }
    get(instanceId) {
      return this.runtimes.get(instanceId);
    }
    list() {
      return [...this.runtimes.values()];
    }
    remove(instanceId) {
      this.runtimes.delete(instanceId);
    }
  }
  const createDistrictPanelProjection = (runtime, playerId, districtId) => createDistrictPanelView(runtime.state, {
    playerId,
    districtId,
    buildCatalog: getPublicBuildingCatalog(runtime.record.mode),
    productionCatalog: runtime.config.balance.productionBuildings ?? {},
    craftCatalog: runtime.config.balance.craftBuildings ?? {},
    buildingActionCatalog: runtime.config.balance.buildingActions ?? {},
    productionMultiplier: runtime.config.balance.productionMultiplier
  });
  const createDistrictListProjection = (runtime, playerId) => createDistrictSummaryViews(runtime.state, playerId);
  const createPlayerProjection = (runtime, playerId) => createPlayerView(runtime.state, playerId);
  const createGameplaySliceProjection = (runtime, playerId, districtId) => {
    var _a;
    const publicMode = toPublicModeConfig(runtime.config);
    const mode = {
      mode: publicMode.mode,
      label: publicMode.label,
      matchStyle: publicMode.matchStyle,
      tickRateMs: publicMode.tickRateMs,
      sessionKeyPrefix: publicMode.sessionKeyPrefix
    };
    return {
      mode,
      player: createPlayerProjection(runtime, playerId),
      districts: createDistrictListProjection(runtime, playerId),
      district: createDistrictPanelProjection(runtime, playerId, districtId),
      reports: createConflictReportViews(runtime.state, {
        playerId,
        limit: ((_a = runtime.config.balance.conflict) == null ? void 0 : _a.reportsLimit) ?? 6
      })
    };
  };
  class ServerInstanceManager {
    constructor() {
      __publicField(this, "registry", new InstanceRegistry());
      __publicField(this, "lifecycle", new InstanceLifecycleService());
    }
    createInstance(instanceId, mode) {
      const runtime = createServerInstanceRuntime(instanceId, mode);
      this.registry.set(runtime);
      return runtime;
    }
    startInstance(instanceId) {
      const runtime = this.registry.get(instanceId);
      return runtime ? this.lifecycle.start(runtime) : void 0;
    }
    pauseInstance(instanceId) {
      const runtime = this.registry.get(instanceId);
      return runtime ? this.lifecycle.pause(runtime) : void 0;
    }
    stopInstance(instanceId) {
      const runtime = this.registry.get(instanceId);
      return runtime ? this.lifecycle.stop(runtime) : void 0;
    }
    restartInstance(instanceId) {
      const runtime = this.registry.get(instanceId);
      return runtime ? this.lifecycle.restart(runtime) : void 0;
    }
    destroyInstance(instanceId) {
      const runtime = this.registry.get(instanceId);
      if (!runtime) {
        return false;
      }
      this.lifecycle.destroy(runtime);
      this.registry.remove(instanceId);
      return true;
    }
    getInstanceById(instanceId) {
      return this.registry.get(instanceId);
    }
    listInstances() {
      return this.registry.list();
    }
    listActiveInstances() {
      return this.registry.list().filter((runtime) => runtime.record.status === "running");
    }
    tickInstance(instanceId) {
      const runtime = this.registry.get(instanceId);
      return runtime ? this.lifecycle.tick(runtime) : void 0;
    }
    dispatchCommand(instanceId, command) {
      const runtime = this.registry.get(instanceId);
      return runtime ? this.lifecycle.dispatch(runtime, command) : void 0;
    }
    getPlayerProjection(instanceId, playerId) {
      const runtime = this.registry.get(instanceId);
      return runtime ? createPlayerProjection(runtime, playerId) : void 0;
    }
    getGameplaySliceProjection(instanceId, playerId, districtId) {
      const runtime = this.registry.get(instanceId);
      return runtime ? createGameplaySliceProjection(runtime, playerId, districtId) : void 0;
    }
    async restoreInstance(instanceId) {
      const runtime = this.registry.get(instanceId);
      return runtime ? this.lifecycle.restore(runtime) : void 0;
    }
    getInstanceMonitorSnapshot(instanceId) {
      const runtime = this.registry.get(instanceId);
      return runtime ? createInstanceMonitorSnapshot(
        runtime.record,
        runtime.state,
        runtime.eventQueue,
        runtime.runtimeHealth
      ) : void 0;
    }
    getInstanceHealth(instanceId) {
      const runtime = this.registry.get(instanceId);
      return runtime ? getInstanceHealth(runtime) : void 0;
    }
    getHealthSummary() {
      const instances = this.registry.list();
      return {
        totalInstances: instances.length,
        runningInstances: instances.filter((runtime) => runtime.record.status === "running").length,
        crashedInstances: instances.filter((runtime) => runtime.record.status === "crashed").length
      };
    }
    async saveInstanceSnapshot(instanceId) {
      const runtime = this.registry.get(instanceId);
      if (!runtime) {
        return false;
      }
      await runtime.snapshotController.save(runtime);
      return true;
    }
  }
  const createReplayLogReader = (snapshotRepository, commandLogRepository, eventLogRepository, diagnosticLogRepository) => ({
    getInstanceSummary: async (instanceId) => {
      const [snapshot, commands, events, diagnostics] = await Promise.all([
        snapshotRepository.loadLatest(instanceId),
        commandLogRepository.listByInstance(instanceId),
        eventLogRepository.listByInstance(instanceId),
        diagnosticLogRepository.listByInstance(instanceId)
      ]);
      const lastCrash = diagnostics.filter((record) => record.category === "crash").sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
      return {
        instanceId,
        lastSnapshotAt: (snapshot == null ? void 0 : snapshot.createdAt) ?? null,
        snapshotSchemaVersion: (snapshot == null ? void 0 : snapshot.version.schemaVersion) ?? null,
        commandVolume: commands.length,
        eventVolume: events.length,
        diagnosticErrorCount: diagnostics.filter((record) => record.level === "error").length,
        lastCrashAt: (lastCrash == null ? void 0 : lastCrash.occurredAt) ?? null
      };
    }
  });
  const createAdminMonitoringFacade = (instanceManager, healthService) => {
    const replayLogReader = createReplayLogReader(
      createNullSnapshotRepository(),
      createNullCommandLogRepository(),
      createNullEventLogRepository(),
      createNullDiagnosticLogRepository()
    );
    return {
      listInstanceSnapshots: () => instanceManager.listInstances().map((runtime) => instanceManager.getInstanceMonitorSnapshot(runtime.record.id)).filter((snapshot) => Boolean(snapshot)),
      getHealthSummary: () => healthService.getSummary(),
      getInstanceHistorySummary: (instanceId) => replayLogReader.getInstanceSummary(instanceId)
    };
  };
  const createInstanceCommandRouter = (instanceManager) => ({
    dispatch: (instanceId, command) => {
      const target = instanceManager.getInstanceById(instanceId);
      return target ? instanceManager.dispatchCommand(instanceId, command) : void 0;
    }
  });
  const createInstanceHealthService = (instanceManager) => ({
    getSummary: () => {
      const instances = instanceManager.listInstances();
      return {
        totalInstances: instances.length,
        runningInstances: instances.filter((runtime) => runtime.record.status === "running").length,
        crashedInstances: instances.filter((runtime) => runtime.record.status === "crashed").length
      };
    }
  });
  const createSnapshotOrchestrator = (instanceManager) => ({
    saveActiveInstances: async () => {
      for (const runtime of instanceManager.listActiveInstances()) {
        await runtime.snapshotController.save(runtime);
      }
    }
  });
  const createTickOrchestrator = (instanceManager) => ({
    tickActiveInstances: () => {
      for (const runtime of instanceManager.listActiveInstances()) {
        instanceManager.tickInstance(runtime.record.id);
      }
    }
  });
  const createCommandIngress = (commandRouter) => ({
    submit: (command) => commandRouter.dispatch(command.serverInstanceId, command)
  });
  const createGameplaySliceTransport = (instanceManager, commandIngress) => ({
    load: (request) => {
      const readModel = instanceManager.getGameplaySliceProjection(
        request.serverInstanceId,
        request.playerId,
        request.districtId
      );
      return readModel ? {
        accepted: true,
        readModel,
        errors: []
      } : createNotFoundResponse("Slice runtime or projection was not found.");
    },
    submit: (request) => {
      const dispatchResult = commandIngress.submit(request.command);
      if (!dispatchResult) {
        return createNotFoundResponse("Target instance was not found for the submitted command.");
      }
      return {
        accepted: dispatchResult.errors.length === 0,
        readModel: createGameplaySliceProjection(
          dispatchResult.runtime,
          request.command.playerId,
          request.focusDistrictId
        ),
        errors: dispatchResult.errors
      };
    }
  });
  const createNotFoundResponse = (message) => ({
    accepted: false,
    readModel: null,
    errors: [
      {
        code: "transport.not_found",
        message
      }
    ]
  });
  const createLiveUpdateGateway = () => ({
    publish: (_instanceId, _event) => {
      return;
    }
  });
  const createServerApp = () => {
    const instanceManager = new ServerInstanceManager();
    const commandRouter = createInstanceCommandRouter(instanceManager);
    const commandIngress = createCommandIngress(commandRouter);
    const gameplaySliceTransport = createGameplaySliceTransport(instanceManager, commandIngress);
    const liveUpdateGateway = createLiveUpdateGateway();
    const tickOrchestrator = createTickOrchestrator(instanceManager);
    const snapshotOrchestrator = createSnapshotOrchestrator(instanceManager);
    const healthService = createInstanceHealthService(instanceManager);
    const adminMonitoring = createAdminMonitoringFacade(instanceManager, healthService);
    return {
      instanceManager,
      commandIngress,
      gameplaySliceTransport,
      liveUpdateGateway,
      tickOrchestrator,
      snapshotOrchestrator,
      healthService,
      adminMonitoring
    };
  };
  const allocateServerPlayerColor = (assignedPlayerColors, requestedColor) => {
    var _a;
    const requested = normalizePlayerColor(requestedColor);
    if (requested && !assignedPlayerColors.has(requested)) {
      assignedPlayerColors.add(requested);
      return requested;
    }
    const nextColor = (_a = PLAYER_COLOR_OPTIONS.find((option) => !assignedPlayerColors.has(option.value))) == null ? void 0 : _a.value;
    if (!nextColor) {
      throw new Error("No unique player colors are left for this server instance.");
    }
    assignedPlayerColors.add(nextColor);
    return nextColor;
  };
  const normalizePlayerColor = (color) => {
    const normalized = String(color || "").trim().toLowerCase();
    return PLAYER_COLOR_OPTIONS.some((option) => option.value === normalized) ? normalized : null;
  };
  const createDistrictBuildingSliceSeed = (options) => {
    var _a, _b, _c, _d, _e;
    const config = resolveModeConfig(options.mode);
    const state = createInitialState(options.instanceId, options.mode);
    state.root.phase = DEV_SETUP_GAME_LIFECYCLE_PHASES.devSetup;
    const districts = [
      {
        ...options.homeDistrict,
        id: options.districtId,
        name: ((_a = options.homeDistrict) == null ? void 0 : _a.name) ?? "Starter District",
        ownerPlayerId: options.playerId,
        zone: ((_b = options.homeDistrict) == null ? void 0 : _b.zone) ?? "commercial",
        status: "claimed",
        adjacentDistrictIds: ((_c = options.homeDistrict) == null ? void 0 : _c.adjacentDistrictIds) ?? ((_d = options.extraDistricts) == null ? void 0 : _d.map((district) => district.id)) ?? [],
        buildingSetKey: ((_e = options.homeDistrict) == null ? void 0 : _e.buildingSetKey) ?? "early-stable-2"
      },
      ...options.extraDistricts ?? []
    ];
    const playerIds = Array.from(
      new Set(
        districts.map((district) => district.ownerPlayerId).filter((ownerPlayerId) => ownerPlayerId !== null)
      )
    );
    const assignedPlayerColors = /* @__PURE__ */ new Set();
    playerIds.forEach((playerId) => {
      const playerColor = allocateServerPlayerColor(
        assignedPlayerColors,
        playerId === options.playerId ? options.playerColor : null
      );
      const player = createSeedPlayer(
        options.instanceId,
        playerId,
        options.districtId,
        playerId === options.playerId ? options.playerAttackLoadout ?? {} : {},
        playerColor,
        playerId === options.playerId ? options.playerFactionId : void 0,
        playerId === options.playerId ? options.playerName : void 0
      );
      state.playersById[player.id] = player;
      state.resourceStatesById[player.resourceStateId] = createSeedPlayerResourceState(
        player,
        config.balance.startingResources
      );
      state.root.playerIds.push(player.id);
    });
    districts.forEach((districtSeed) => {
      const district = createSeedDistrict(options.instanceId, config.balance.buildSlotLimit, districtSeed);
      state.districtsById[district.id] = district;
      state.root.districtIds.push(district.id);
      getSeedBuildingTypes(districtSeed, district.zone).forEach((buildingTypeId, index) => {
        var _a2;
        const building = createSeedBuilding(
          options.instanceId,
          district,
          buildingTypeId,
          index,
          resolveSeedBuildingDisplayName(districtSeed, index)
        );
        const productionProfile = (_a2 = config.balance.productionBuildings) == null ? void 0 : _a2[building.buildingTypeId];
        state.buildingsById[building.id] = building;
        if (building && productionProfile) {
          state.resourceStatesById[`resource:${building.id}`] = createSeedBuildingResourceState(
            building,
            productionProfile.resourceKey
          );
        }
      });
    });
    return state;
  };
  const getSeedBuildingTypes = (districtSeed, zone) => {
    if (districtSeed.buildingTypes) {
      return districtSeed.buildingTypes;
    }
    const configured = resolveDistrictBuildingTypes({
      districtId: districtSeed.id,
      zone,
      buildingSetKey: districtSeed.buildingSetKey,
      buildingTier: districtSeed.buildingTier,
      legacyBuildingNames: districtSeed.legacyBuildingNames
    });
    return configured.length > 0 ? configured : resolveDistrictBuildingTypes({ districtId: districtSeed.id, zone: "residential", buildingSetKey: "res-early-1" });
  };
  const createSeedPlayer = (instanceId, playerId, homeDistrictId, attackLoadout, color, factionId, playerName) => ({
    id: playerId,
    accountId: `account:${playerId}`,
    serverInstanceId: instanceId,
    name: playerName || (playerId.startsWith("player:") ? playerId.replace(/^player:/, "").replace(/:/g, " ") : "Seed Player"),
    factionId: factionId ?? "mafian",
    color,
    status: "active",
    allianceId: null,
    homeDistrictId,
    attackLoadout,
    resourceStateId: `resource:${playerId}`,
    cooldownStateId: `cooldown:${playerId}`,
    effectStateId: `effect:${playerId}`,
    policeStateId: `police:${playerId}`,
    createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    lastActionAt: null,
    version: 1
  });
  const createSeedDistrict = (instanceId, slotCount, districtSeed) => ({
    ...(() => {
      const zone = districtSeed.zone ?? "residential";
      const buildingTypes = getSeedBuildingTypes(districtSeed, zone);
      return {
        id: districtSeed.id,
        serverInstanceId: instanceId,
        templateId: `district-template:${zone}`,
        name: districtSeed.name,
        zone,
        adjacentDistrictIds: districtSeed.adjacentDistrictIds ?? [],
        ownerPlayerId: districtSeed.ownerPlayerId,
        controllerAllianceId: null,
        heat: districtSeed.heat ?? 0,
        influence: districtSeed.influence ?? 0,
        buildingIds: buildingTypes.map((buildingType, index) => createSeedBuildingId(districtSeed.id, buildingType, index)),
        defenseLoadout: districtSeed.defenseLoadout ?? {},
        slotCount: Math.max(slotCount, buildingTypes.length),
        status: districtSeed.status ?? (districtSeed.ownerPlayerId ? "claimed" : "neutral"),
        resourceModifiers: {},
        version: 1
      };
    })()
  });
  const createSeedBuildingId = (districtId, buildingType, index) => `building:${districtId.replace(/[^a-zA-Z0-9-]/g, "-")}:${buildingType}:${index + 1}`;
  const resolveSeedBuildingDisplayName = (districtSeed, index) => {
    var _a;
    return String(((_a = districtSeed.legacyBuildingDisplayNames) == null ? void 0 : _a[index]) || "").trim() || null;
  };
  const createSeedBuilding = (instanceId, district, buildingTypeId, index, displayName) => ({
    id: createSeedBuildingId(district.id, buildingTypeId, index),
    serverInstanceId: instanceId,
    districtId: district.id,
    ownerPlayerId: district.ownerPlayerId ?? "player:neutral",
    buildingTypeId,
    displayName,
    level: 1,
    status: "active",
    processing: null,
    actionCooldowns: {},
    startedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    completedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    version: 1
  });
  const createSeedPlayerResourceState = (player, startingResources) => ({
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: player.id,
    balances: {
      ...startingResources
    },
    incomeModifiers: {},
    lastUpdatedTick: 0,
    version: 1
  });
  const createSeedBuildingResourceState = (building, resourceKey) => ({
    id: `resource:${building.id}`,
    ownerType: "building",
    ownerId: building.id,
    balances: {
      [resourceKey]: 0
    },
    incomeModifiers: {},
    lastUpdatedTick: 0,
    version: 1
  });
  const FALLBACK_MODE = "free";
  const FALLBACK_SERVER_ID = "admin-slice";
  const ATTACK_LOADOUT_KEYS = ["pistol", "grenade", "smg", "bazooka"];
  const DEFENSE_LOADOUT_KEYS = ["vest", "barricades", "cameras", "defense-tower", "alarm"];
  const normalizeMode = (mode) => mode === "war" ? "war" : FALLBACK_MODE;
  const normalizeServerId = (serverId) => {
    const source = String(serverId || readDatasetValue("[data-gang-server]") || "").trim().replace(/^instance:/i, "");
    return source ? source.toLowerCase().replace(/\s+/g, "-") : FALLBACK_SERVER_ID;
  };
  const normalizeIdentity = (identity, fallbackPlayerId) => {
    const normalizedIdentity = String(identity || "").trim();
    return normalizedIdentity || fallbackPlayerId;
  };
  const normalizeFactionId = (factionId) => {
    const normalizedFactionId = String(factionId || "").trim();
    return normalizedFactionId ? normalizedFactionId : "mafian";
  };
  const normalizeAttackLoadout = (weapons) => ATTACK_LOADOUT_KEYS.reduce((loadout, weaponId) => {
    loadout[weaponId] = normalizeCount(weapons == null ? void 0 : weapons[weaponId]);
    return loadout;
  }, {});
  const normalizeDefenseLoadout = (loadout) => {
    if (!isRecord(loadout)) {
      return {};
    }
    return DEFENSE_LOADOUT_KEYS.reduce((normalizedLoadout, weaponId) => {
      const amount = normalizeCount(loadout[weaponId]);
      if (amount > 0) {
        normalizedLoadout[weaponId] = amount;
      }
      return normalizedLoadout;
    }, {});
  };
  const uniqueNumbers = (...sources) => {
    const normalizedNumbers = /* @__PURE__ */ new Set();
    sources.forEach((source) => {
      if (!Array.isArray(source)) {
        return;
      }
      source.forEach((value) => {
        const normalizedValue = normalizeDistrictNumber(value);
        if (normalizedValue > 0) {
          normalizedNumbers.add(normalizedValue);
        }
      });
    });
    return Array.from(normalizedNumbers).sort((left, right) => left - right);
  };
  const orderDistrictNumbers = (homeDistrictNumber, districtNumbers) => [
    homeDistrictNumber,
    ...districtNumbers.filter((districtNumber) => districtNumber !== homeDistrictNumber)
  ];
  const findFallbackNeighborDistrictNumber = (homeDistrictNumber, knownDistricts) => {
    let offset = 1;
    while (knownDistricts.has(homeDistrictNumber + offset)) {
      offset += 1;
    }
    return homeDistrictNumber + offset;
  };
  const normalizeDistrictNumber = (value) => {
    const normalized = Number.parseInt(String(value || "").replace(/[^0-9-]/g, ""), 10);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
  };
  const toDistrictId = (districtNumber) => `district:${districtNumber}`;
  const toDistrictNumber = (districtId) => normalizeDistrictNumber(districtId);
  const formatDistrictName = (districtId) => `District ${toDistrictNumber(districtId)}`;
  const readDatasetDistrictLabel = (selector) => {
    const rawValue = readDatasetValue(selector);
    const matchedDistrictNumber = rawValue.match(/\d+/);
    return (matchedDistrictNumber == null ? void 0 : matchedDistrictNumber[0]) || rawValue;
  };
  const isRecord = (value) => typeof value === "object" && value !== null;
  const normalizeCount = (value) => {
    const normalized = Number.parseInt(String(value ?? 0), 10);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
  };
  const readDatasetValue = (selector) => {
    const element = document.querySelector(selector);
    return String((element == null ? void 0 : element.textContent) || "").trim();
  };
  const readLegacyMapDistrictsByNumber = () => {
    var _a;
    const byNumber = /* @__PURE__ */ new Map();
    const districts = Array.isArray((_a = window.Empire) == null ? void 0 : _a.districts) ? window.Empire.districts : [];
    districts.forEach((district) => {
      if (!isRecord(district)) {
        return;
      }
      const districtRecord = district;
      const districtNumber = normalizeDistrictNumber(
        districtRecord.mapId ?? districtRecord.map_id ?? districtRecord.id ?? districtRecord.name
      );
      if (districtNumber > 0) {
        byNumber.set(districtNumber, districtRecord);
      }
    });
    return byNumber;
  };
  const normalizeMapDistrictName = (mapDistrict, districtId) => normalizeMapDistrictString(mapDistrict == null ? void 0 : mapDistrict.name) ?? formatDistrictName(districtId);
  const normalizeMapDistrictZone = (mapDistrict) => {
    var _a;
    return (_a = normalizeMapDistrictString((mapDistrict == null ? void 0 : mapDistrict.type) ?? (mapDistrict == null ? void 0 : mapDistrict.zone))) == null ? void 0 : _a.toLowerCase();
  };
  const normalizeMapDistrictBuildings = (mapDistrict) => {
    if (!Array.isArray(mapDistrict == null ? void 0 : mapDistrict.buildings)) {
      return void 0;
    }
    const buildings = mapDistrict.buildings.map((building) => String(building || "").trim()).filter(Boolean);
    return buildings.length > 0 ? buildings : void 0;
  };
  const normalizeMapDistrictBuildingDisplayNames = (mapDistrict) => {
    if (!Array.isArray(mapDistrict == null ? void 0 : mapDistrict.buildingNameOverrides)) {
      return void 0;
    }
    const displayNames = mapDistrict.buildingNameOverrides.map(
      (buildingName) => String(buildingName || "").trim()
    );
    return displayNames.some(Boolean) ? displayNames : void 0;
  };
  const normalizeMapDistrictString = (value) => {
    const normalized = String(value || "").trim();
    return normalized || void 0;
  };
  const normalizeMapDistrictNumber = (value) => {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : void 0;
  };
  const SESSION_STORAGE_KEY = "empireStreets.session.v1";
  const FALLBACK_PLAYER_ID = "Ty";
  const FALLBACK_DISTRICT_NUMBER = 27;
  const resolveLiveGameplaySliceBootstrap = () => {
    var _a, _b, _c, _d, _e, _f, _g;
    const session = readAuthoritySession();
    const districtState = readDistrictState();
    const mode = normalizeMode((_a = session == null ? void 0 : session.registration) == null ? void 0 : _a.serverMode);
    const playerName = normalizeIdentity((_b = session == null ? void 0 : session.registration) == null ? void 0 : _b.identity, FALLBACK_PLAYER_ID);
    const playerId = playerName;
    const playerFactionId = normalizeFactionId((_c = session == null ? void 0 : session.registration) == null ? void 0 : _c.factionId);
    const playerColor = ((_d = session == null ? void 0 : session.registration) == null ? void 0 : _d.gangColor) ?? null;
    const playerAttackLoadout = normalizeAttackLoadout((_e = session == null ? void 0 : session.inventory) == null ? void 0 : _e.weapons);
    const homeDistrictNumber = resolveHomeDistrictNumber(session, districtState);
    const districtNumbers = resolveDistrictNumbers(homeDistrictNumber, session, districtState);
    const districtIds = districtNumbers.map(toDistrictId);
    const defenseLoadouts = ((_f = session == null ? void 0 : session.world) == null ? void 0 : _f.districtDefenseLoadoutById) || {};
    const ownedDistrictNumbers = new Set(resolveOwnedDistrictNumbers(session, districtState, homeDistrictNumber));
    const legacyMapDistricts = readLegacyMapDistrictsByNumber();
    const homeDistrict = createDistrictSeed({
      districtId: toDistrictId(homeDistrictNumber),
      allDistrictIds: districtIds,
      playerId,
      isOwnedByPlayer: true,
      defenseLoadout: normalizeDefenseLoadout(defenseLoadouts[String(homeDistrictNumber)]),
      mapDistrict: legacyMapDistricts.get(homeDistrictNumber)
    });
    const extraDistricts = districtIds.filter((districtId) => districtId !== toDistrictId(homeDistrictNumber)).map(
      (districtId) => createDistrictSeed({
        districtId,
        allDistrictIds: districtIds,
        playerId,
        isOwnedByPlayer: ownedDistrictNumbers.has(toDistrictNumber(districtId)),
        defenseLoadout: normalizeDefenseLoadout(defenseLoadouts[String(toDistrictNumber(districtId))]),
        mapDistrict: legacyMapDistricts.get(toDistrictNumber(districtId))
      })
    );
    return {
      instanceId: `instance:${normalizeServerId((_g = session == null ? void 0 : session.registration) == null ? void 0 : _g.serverId)}`,
      playerId,
      playerName,
      playerFactionId,
      playerColor,
      districtId: toDistrictId(homeDistrictNumber),
      mode,
      playerAttackLoadout,
      homeDistrict,
      extraDistricts
    };
  };
  const readAuthoritySession = () => {
    var _a;
    const serverSession = ((_a = window.empireStreetsServerState) == null ? void 0 : _a.session) || window.empireStreetsServerSession;
    if (isRecord(serverSession)) {
      return serverSession;
    }
    try {
      const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!rawValue) {
        return null;
      }
      const parsedValue = JSON.parse(rawValue);
      return isRecord(parsedValue) ? parsedValue : null;
    } catch {
      return null;
    }
  };
  const readDistrictState = () => {
    var _a, _b;
    try {
      const state = (_b = (_a = window.empireStreetsDistrictState) == null ? void 0 : _a.getState) == null ? void 0 : _b.call(_a);
      return isRecord(state) ? state : null;
    } catch {
      return null;
    }
  };
  const resolveHomeDistrictNumber = (session, districtState) => {
    var _a;
    const registrationDistrict = normalizeDistrictNumber((_a = session == null ? void 0 : session.registration) == null ? void 0 : _a.startDistrictId);
    if (registrationDistrict > 0) {
      return registrationDistrict;
    }
    const ownedDistrictId = resolveOwnedDistrictNumbers(session, districtState)[0];
    if (ownedDistrictId > 0) {
      return ownedDistrictId;
    }
    const domDistrict = normalizeDistrictNumber(readDatasetDistrictLabel("[data-gang-start-district]"));
    return domDistrict > 0 ? domDistrict : FALLBACK_DISTRICT_NUMBER;
  };
  const resolveDistrictNumbers = (homeDistrictNumber, session, districtState) => {
    var _a;
    const ownedDistrictNumbers = resolveOwnedDistrictNumbers(session, districtState, homeDistrictNumber);
    const revealedDistrictNumbers = uniqueNumbers(
      districtState == null ? void 0 : districtState.revealedDistrictIds,
      districtState == null ? void 0 : districtState.destroyedDistrictIds,
      (_a = session == null ? void 0 : session.world) == null ? void 0 : _a.destroyedDistrictIds
    ).filter((districtNumber) => !ownedDistrictNumbers.includes(districtNumber));
    const knownDistrictNumbers = uniqueNumbers([homeDistrictNumber], ownedDistrictNumbers, revealedDistrictNumbers);
    if (knownDistrictNumbers.some((districtNumber) => !ownedDistrictNumbers.includes(districtNumber))) {
      return orderDistrictNumbers(homeDistrictNumber, knownDistrictNumbers);
    }
    return orderDistrictNumbers(homeDistrictNumber, [
      ...knownDistrictNumbers,
      findFallbackNeighborDistrictNumber(homeDistrictNumber, new Set(knownDistrictNumbers))
    ]);
  };
  const resolveOwnedDistrictNumbers = (session, districtState, homeDistrictNumber) => {
    var _a;
    return uniqueNumbers(
      (_a = session == null ? void 0 : session.world) == null ? void 0 : _a.ownedDistrictIds,
      districtState == null ? void 0 : districtState.ownedDistrictIds,
      homeDistrictNumber ? [homeDistrictNumber] : []
    );
  };
  const createDistrictSeed = ({
    districtId,
    allDistrictIds,
    playerId,
    isOwnedByPlayer,
    defenseLoadout,
    mapDistrict
  }) => ({
    id: districtId,
    name: normalizeMapDistrictName(mapDistrict, districtId),
    ownerPlayerId: isOwnedByPlayer ? playerId : null,
    status: isOwnedByPlayer ? "claimed" : "neutral",
    zone: normalizeMapDistrictZone(mapDistrict),
    heat: normalizeMapDistrictNumber(mapDistrict == null ? void 0 : mapDistrict.heat),
    influence: normalizeMapDistrictNumber(mapDistrict == null ? void 0 : mapDistrict.influence),
    legacyBuildingNames: normalizeMapDistrictBuildings(mapDistrict),
    legacyBuildingDisplayNames: normalizeMapDistrictBuildingDisplayNames(mapDistrict),
    buildingSetKey: normalizeMapDistrictString(mapDistrict == null ? void 0 : mapDistrict.buildingSetKey),
    buildingSetTitle: normalizeMapDistrictString(mapDistrict == null ? void 0 : mapDistrict.buildingSetTitle),
    buildingTier: normalizeMapDistrictString(mapDistrict == null ? void 0 : mapDistrict.buildingTier),
    adjacentDistrictIds: allDistrictIds.filter((candidateId) => candidateId !== districtId),
    defenseLoadout
  });
  const createDeprecatedDevBuildStructureCommand = (input) => ({
    id: input.commandId,
    type: "build-structure",
    mode: input.mode,
    playerId: input.playerId,
    serverInstanceId: input.serverInstanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: input.districtId,
      buildingTypeId: input.buildingTypeId,
      slotIndex: input.slotIndex
    },
    clientRequestId: null
  });
  const createAdminGameplaySliceDemo = () => {
    let sequence = 0;
    let bootstrapState = resolveLiveGameplaySliceBootstrap();
    let server = createServerApp();
    let client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const bootstrap = () => {
      bootstrapState = resolveLiveGameplaySliceBootstrap();
      server = createServerApp();
      const runtime = server.instanceManager.createInstance(bootstrapState.instanceId, bootstrapState.mode);
      runtime.state = createDistrictBuildingSliceSeed({
        instanceId: bootstrapState.instanceId,
        playerId: bootstrapState.playerId,
        playerName: bootstrapState.playerName,
        playerFactionId: bootstrapState.playerFactionId,
        playerColor: bootstrapState.playerColor,
        districtId: bootstrapState.districtId,
        mode: bootstrapState.mode,
        playerAttackLoadout: bootstrapState.playerAttackLoadout,
        homeDistrict: bootstrapState.homeDistrict,
        extraDistricts: bootstrapState.extraDistricts
      });
      server.instanceManager.startInstance(bootstrapState.instanceId);
      client = createClientApp({
        transport: createInMemoryClientTransport(server.gameplaySliceTransport)
      });
    };
    const nextCommandId = (prefix) => {
      sequence += 1;
      return `${prefix}:${sequence}`;
    };
    const getSelectedDistrictId = () => {
      var _a;
      return ((_a = client.getRenderState().districtPanel) == null ? void 0 : _a.districtId) ?? null;
    };
    const loadCurrentSlice = () => client.load({
      serverInstanceId: bootstrapState.instanceId,
      playerId: bootstrapState.playerId,
      districtId: bootstrapState.districtId
    });
    bootstrap();
    return {
      load: async () => loadCurrentSlice(),
      reset: async () => {
        bootstrap();
        return loadCurrentSlice();
      },
      selectDistrict: async (districtId) => client.selectDistrict(districtId),
      build: async (buildingTypeId, slotIndex) => {
        const selectedDistrictId = getSelectedDistrictId();
        if (!selectedDistrictId) {
          return client.getRenderState();
        }
        return client.dispatch(
          createDeprecatedDevBuildStructureCommand({
            commandId: nextCommandId("command:build"),
            serverInstanceId: bootstrapState.instanceId,
            playerId: bootstrapState.playerId,
            mode: bootstrapState.mode,
            districtId: selectedDistrictId,
            buildingTypeId,
            slotIndex,
            issuedAt: (/* @__PURE__ */ new Date()).toISOString()
          })
        );
      },
      attack: async (targetDistrictId) => {
        const selectedDistrictId = getSelectedDistrictId();
        if (!selectedDistrictId) {
          return client.getRenderState();
        }
        return client.dispatch(
          createAttackDistrictCommand({
            commandId: nextCommandId("command:attack"),
            serverInstanceId: bootstrapState.instanceId,
            playerId: bootstrapState.playerId,
            mode: bootstrapState.mode,
            sourceDistrictId: selectedDistrictId,
            targetDistrictId,
            issuedAt: (/* @__PURE__ */ new Date()).toISOString()
          })
        );
      },
      collect: async (buildingId) => {
        const selectedDistrictId = getSelectedDistrictId();
        if (!selectedDistrictId) {
          return client.getRenderState();
        }
        return client.dispatch(
          createCollectProductionCommand({
            commandId: nextCommandId("command:collect"),
            serverInstanceId: bootstrapState.instanceId,
            playerId: bootstrapState.playerId,
            mode: bootstrapState.mode,
            districtId: selectedDistrictId,
            buildingId,
            issuedAt: (/* @__PURE__ */ new Date()).toISOString()
          })
        );
      },
      craft: async (buildingId, recipeId) => {
        const slice = client.getGameplaySlice();
        if (!slice) {
          return client.getRenderState();
        }
        return client.dispatch(
          createCraftItemCommand({
            commandId: nextCommandId("command:craft"),
            slice,
            buildingId,
            recipeId,
            issuedAt: (/* @__PURE__ */ new Date()).toISOString()
          })
        );
      },
      createCommandId: (prefix) => nextCommandId(prefix),
      getClientShell: () => client,
      getRenderState: () => client.getRenderState()
    };
  };
  const createGameplaySliceSurfaceApi = () => ({
    mount: (mounts) => mountGameplaySliceSurface(mounts),
    autoMountAdminPage: () => {
      const mounts = getAdminPageMounts();
      return mounts ? mountGameplaySliceSurface(mounts) : null;
    }
  });
  const mountGameplaySliceSurface = (mounts) => {
    const demo = createAdminGameplaySliceDemo();
    const actionRouter = createClientSurfaceActionRouter({
      client: demo.getClientShell(),
      createCommandId: (prefix) => demo.createCommandId(prefix)
    });
    const renderState = (state) => {
      var _a;
      mounts.toolbarMount.innerHTML = [
        '<div class="slice-demo-toolbar">',
        state.topBarHtml,
        `<div class="slice-demo-connection">Connection: ${state.connection.status}</div>`,
        `<button type="button" data-demo-reset="true">Reload slice</button>`,
        "</div>"
      ].join("");
      mounts.navigationMount.innerHTML = [
        '<h3 class="placeholder-title">Gameplay slice bridge</h3>',
        '<p class="panel-note">Tenhle panel čte session hry, bootstrapuje nový slice a dál běží přes `apps/server` a `packages/game-core` bez klientské gameplay autority.</p>',
        '<ul class="slice-demo-list">',
        "<li>klik na district přepíná server-fed panel</li>",
        "<li>pevné budovy, speciální akce, spy, trap a attack jdou přes client command router</li>",
        "<li>reports panel je čistě server-fed projection</li>",
        "<li>render je čistě z aktuálního read modelu</li>",
        "</ul>"
      ].join("");
      mounts.filterMount.innerHTML = [
        '<h3 class="placeholder-title">Current selection</h3>',
        state.districtPanel ? `<p class="panel-note">District: <strong>${state.districtPanel.title}</strong></p>` : '<p class="panel-note">No district selected.</p>',
        `<p class="panel-note">Player: <strong>${((_a = state.player) == null ? void 0 : _a.playerId) ?? "n/a"}</strong></p>`,
        `<p class="panel-note">Visible districts: <strong>${state.mapDistricts.length}</strong></p>`
      ].join("");
      mounts.contentMount.innerHTML = [
        '<div class="slice-demo-grid">',
        '<section class="slice-demo-surface">',
        '<h3 class="placeholder-title">District map/list</h3>',
        state.mapHtml,
        "</section>",
        '<section class="slice-demo-surface">',
        '<h3 class="placeholder-title">District panel</h3>',
        state.sidePanelHtml || '<p class="panel-note">No district panel available.</p>',
        "</section>",
        "</div>",
        state.errors.length > 0 ? `<section class="slice-demo-errors"><h3 class="placeholder-title">Errors</h3>${state.errors.map((error) => `<p>${error.message}</p>`).join("")}</section>` : ""
      ].join("");
      mounts.modalRoot.innerHTML = [
        '<span class="placeholder-label">Overlay root</span>',
        '<h3 class="placeholder-title">Command trace</h3>',
        `<p class="panel-note">Pending commands: ${state.districtPanel ? "interactive" : "idle"}</p>`
      ].join("");
      mounts.noticeRoot.innerHTML = [
        '<span class="placeholder-label">Overlay root</span>',
        '<h3 class="placeholder-title">Run mode</h3>',
        '<p class="panel-note">Direct embedded gameplay slice panel with live session bootstrap.</p>'
      ].join("");
      refreshCooldownLabels();
    };
    const onClick = async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const resetButton = target.closest("button[data-demo-reset]");
      if (resetButton) {
        renderState(await demo.reset());
        return;
      }
      const nextState = await actionRouter.handleTarget(target);
      if (nextState) {
        renderState(nextState);
      }
    };
    const roots = [
      mounts.toolbarMount,
      mounts.navigationMount,
      mounts.filterMount,
      mounts.contentMount,
      mounts.modalRoot,
      mounts.noticeRoot
    ];
    const clickListener = (event) => {
      void onClick(event);
    };
    const refreshCooldownLabels = () => {
      roots.forEach((root) => refreshLiveCooldownLabels(root));
    };
    const cooldownTimerId = window.setInterval(refreshCooldownLabels, 1e3);
    roots.forEach((root) => root.addEventListener("click", clickListener));
    void demo.load().then(renderState);
    return {
      destroy: () => {
        window.clearInterval(cooldownTimerId);
        roots.forEach((root) => root.removeEventListener("click", clickListener));
        roots.forEach((root) => {
          root.innerHTML = "";
        });
      }
    };
  };
  const getAdminPageMounts = () => {
    const toolbarMount = document.querySelector("#admin-toolbar-mount");
    const navigationMount = document.querySelector("#admin-nav-mount");
    const filterMount = document.querySelector("#admin-filter-mount");
    const contentMount = document.querySelector("#admin-content-mount");
    const modalRoot = document.querySelector("#admin-modal-root");
    const noticeRoot = document.querySelector("#admin-notice-root");
    return toolbarMount && navigationMount && filterMount && contentMount && modalRoot && noticeRoot ? {
      toolbarMount,
      navigationMount,
      filterMount,
      contentMount,
      modalRoot,
      noticeRoot
    } : null;
  };
  window.EmpireAdminSliceDemo = createGameplaySliceSurfaceApi();
  window.EmpireAdminSliceDemo.autoMountAdminPage();
})();
