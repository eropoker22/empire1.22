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
  const renderBuildingDetailPopup = (building2) => {
    const zoneKey = toCssToken$1(building2.zoneLabel);
    return [
      `<section class="district-building-popup district-building-popup--${zoneKey}" role="dialog" aria-label="${building2.label} detail" data-building-zone="${zoneKey}" data-building-popup-id="${building2.buildingId}">`,
      `<header class="district-building-popup__header">`,
      `<div>`,
      `<p class="district-building-popup__eyebrow">${building2.zoneLabel} · ${building2.roleLabel}</p>`,
      `<h5 class="district-building-popup__title">${building2.label}</h5>`,
      `<p class="district-building-popup__type">${building2.typeLabel}</p>`,
      `</div>`,
      `<span class="district-building-popup__badge">${building2.statusLabel}</span>`,
      `</header>`,
      `<div class="district-building-popup__info-card">`,
      `<span class="district-building-popup__section-label">Info</span>`,
      `<p class="district-building-popup__info">${building2.info}</p>`,
      `</div>`,
      `<p class="district-building-popup__section-label">Statistiky</p>`,
      `<div class="district-building-popup__stats">`,
      building2.stats.map((stat2) => [
        `<span class="district-building-popup__stat">`,
        `<span class="district-building-popup__stat-label">${stat2.label}</span>`,
        `<strong class="district-building-popup__stat-value">${stat2.value}</strong>`,
        `</span>`
      ].join("")).join(""),
      `</div>`,
      `<div class="district-building-popup__actions">`,
      `<div class="district-building-popup__actions-head">`,
      `<p class="district-building-popup__section-label">Speciální akce</p>`,
      `<span class="district-building-popup__count">${building2.specialActions.length}</span>`,
      `</div>`,
      building2.specialActions.length > 0 ? [
        `<div class="district-building-popup__action-grid">`,
        building2.specialActions.map((action2) => renderSpecialAction(building2, action2)).join(""),
        `</div>`
      ].join("") : `<p class="district-panel__empty-copy">Tahle budova nemá v katalogu speciální akce.</p>`,
      `</div>`,
      `</section>`
    ].join("");
  };
  const renderSpecialAction = (building2, action2) => {
    const disabledAttribute = action2.disabled ? " disabled" : "";
    const reasonAttribute = action2.disabledReason ? ` data-disabled-reason="${action2.disabledReason}"` : "";
    return [
      `<article class="district-building-popup__action${action2.disabled ? " is-disabled" : ""}" data-special-action-id="${action2.actionId}">`,
      `<span class="district-building-popup__action-light" aria-hidden="true"></span>`,
      `<div class="district-building-popup__action-copy">`,
      `<span class="district-building-popup__action-state">${action2.disabled ? "Blocked" : "Ready"}</span>`,
      `<strong>${action2.label}</strong>`,
      `<span>${action2.description}</span>`,
      `<div class="district-building-popup__action-metrics">`,
      `<small>${action2.effectSummary}</small>`,
      `<small>CD ${renderLiveCooldown$1(action2)}</small>`,
      `<small>${action2.durationLabel}</small>`,
      `<small>Heat ${action2.heatLabel}</small>`,
      `</div>`,
      `</div>`,
      `<button class="district-panel__action-button district-panel__action-button--craft district-building-popup__run-button" data-building-action-building-id="${building2.buildingId}" data-building-action-id="${action2.actionId}"${disabledAttribute}${reasonAttribute}>Spustit</button>`,
      action2.disabledReason ? `<p class="district-panel__action-reason">${action2.disabledReason}</p>` : "",
      `</article>`
    ].join("");
  };
  const toCssToken$1 = (value) => String(value || "building").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "building";
  const renderLiveCooldown$1 = (action2) => action2.cooldownEndsAtMs && action2.cooldownRemainingMs > 0 ? [
    `<span data-live-cooldown="true"`,
    ` data-cooldown-ends-at-ms="${action2.cooldownEndsAtMs}"`,
    ` data-cooldown-prefix=""`,
    ` data-cooldown-ready-label="Ready after server sync">`,
    action2.cooldownLabel.replace(/^Cooldown\s+/u, ""),
    `</span>`
  ].join("") : action2.cooldownLabel;
  const createRunBuildingActionCommand = (input) => {
    const district = input.slice.district;
    const building2 = district == null ? void 0 : district.buildings.find((candidate) => candidate.buildingId === input.buildingId);
    const action2 = building2 == null ? void 0 : building2.actions.find((candidate) => candidate.actionId === input.actionId && candidate.enabled);
    if (!district || !building2 || !action2) {
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
        buildingId: building2.buildingId,
        actionId: action2.actionId
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
  const renderDistrictBuilding = (building2, isOpen = false) => [
    `<article class="district-panel__slot district-panel__slot--${toCssToken(building2.buildingTypeId)}" data-building-id="${building2.buildingId}" data-building-type="${building2.buildingTypeId}">`,
    `<div class="district-panel__slot-head">`,
    `<div class="district-panel__slot-heading">`,
    `<span class="district-panel__slot-icon" aria-hidden="true">${getBuildingIcon(building2.buildingTypeId)}</span>`,
    `<div>`,
    `<p class="district-panel__slot-index">${building2.typeLabel}</p>`,
    `<h4 class="district-panel__slot-title">${building2.label}</h4>`,
    `</div>`,
    `</div>`,
    `<span class="district-panel__slot-state">${building2.statusLabel}</span>`,
    `</div>`,
    `<p class="district-panel__slot-summary">${building2.summaryLabel}</p>`,
    `<details class="district-building-popup-host" data-building-popup-target="${building2.buildingId}"${isOpen ? " open" : ""}>`,
    `<summary class="district-panel__action-button district-panel__action-button--info">Stats / Info / Speciální akce</summary>`,
    renderBuildingDetailPopup(building2),
    `</details>`,
    building2.actions.length > 0 ? building2.actions.map((action2) => {
      const disabledAttribute = action2.disabled ? " disabled" : "";
      const reasonAttribute = action2.disabledReason ? ` data-disabled-reason="${action2.disabledReason}"` : "";
      return [
        `<div class="district-panel__production">`,
        `<div class="district-panel__production-head">`,
        `<strong class="district-panel__production-title">${action2.label}</strong>`,
        `<span class="district-panel__production-rate">${renderLiveCooldown(action2)}</span>`,
        `</div>`,
        `<p class="district-panel__slot-summary">${action2.description}</p>`,
        `<div class="district-panel__production-metrics">`,
        `<span class="district-panel__production-metric">Cost ${action2.inputSummary}</span>`,
        `<span class="district-panel__production-metric">Gain ${action2.outputSummary}</span>`,
        `<span class="district-panel__production-metric">Heat ${action2.heatLabel}</span>`,
        `<span class="district-panel__production-metric">Influence ${action2.influenceLabel}</span>`,
        `</div>`,
        `<div class="district-panel__action-row">`,
        `<button class="district-panel__action-button district-panel__action-button--craft" data-building-action-building-id="${building2.buildingId}" data-building-action-id="${action2.actionId}"${disabledAttribute}${reasonAttribute}>${action2.label}</button>`,
        action2.disabledReason ? `<p class="district-panel__action-reason">${action2.disabledReason}</p>` : "",
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
  const renderLiveCooldown = (action2) => action2.cooldownEndsAtMs && action2.cooldownRemainingMs > 0 ? [
    `<span data-live-cooldown="true"`,
    ` data-cooldown-ends-at-ms="${action2.cooldownEndsAtMs}"`,
    ` data-cooldown-prefix="Cooldown "`,
    ` data-cooldown-ready-label="Ready after server sync">`,
    action2.cooldownLabel,
    `</span>`
  ].join("") : action2.cooldownLabel;
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
    panel.buildings.length > 0 ? panel.buildings.map((building2) => renderDistrictBuilding(building2, building2.buildingId === panel.selectedBuildingId)).join("") : `<p class="district-panel__empty-copy">No fixed buildings are assigned to this district projection.</p>`,
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
      const action2 = resolveClientSurfaceAction(target);
      if (!action2) {
        return null;
      }
      if (action2.kind === "select-district") {
        return options.client.selectDistrict(action2.districtId);
      }
      if (action2.kind === "open-building") {
        return options.client.selectBuilding(action2.buildingId);
      }
      const slice = options.client.getGameplaySlice();
      const district = slice == null ? void 0 : slice.district;
      if (!slice || !district) {
        return null;
      }
      const issuedAt = (options.getIssuedAt ?? (() => (/* @__PURE__ */ new Date()).toISOString()))();
      const mode = slice.mode.mode;
      switch (action2.kind) {
        case "attack":
          return options.client.dispatch(
            createAttackDistrictCommand({
              commandId: options.createCommandId("command:attack"),
              serverInstanceId: slice.player.instanceId,
              playerId: slice.player.playerId,
              mode,
              sourceDistrictId: district.districtId,
              targetDistrictId: action2.targetDistrictId,
              issuedAt
            })
          );
        case "spy":
          return options.client.dispatch(
            createSpyDistrictCommand({
              commandId: options.createCommandId("command:spy"),
              slice,
              targetDistrictId: action2.targetDistrictId,
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
              buildingId: action2.buildingId,
              actionId: action2.actionId,
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
              buildingId: action2.buildingId,
              issuedAt
            })
          );
        case "craft":
          return options.client.dispatch(
            createCraftItemCommand({
              commandId: options.createCommandId("command:craft"),
              slice,
              buildingId: action2.buildingId,
              recipeId: action2.recipeId,
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
    const selectedBuildingId = slice.district.buildings.some((building2) => building2.buildingId === uiState.selectedBuildingId) ? uiState.selectedBuildingId : null;
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
      buildings: slice.district.buildings.map((building2) => ({
        buildingId: building2.buildingId,
        buildingTypeId: building2.buildingTypeId,
        label: building2.displayName || building2.label,
        variantName: building2.variantName,
        typeLabel: building2.label,
        zoneLabel: toTitleCase$3(building2.zone),
        roleLabel: building2.role,
        info: building2.info,
        statusLabel: `${building2.status} · level ${building2.level}`,
        summaryLabel: `${building2.actions.filter((action2) => action2.enabled).length}/${building2.actions.length} actions ready`,
        stats: building2.stats.map((stat2) => ({
          label: stat2.label,
          value: stat2.value
        })),
        specialActions: building2.specialActions.map((action2) => {
          const cooldown = createCooldownCountdown(action2.cooldownRemainingTicks, tickRateMs, nowMs);
          return {
            actionId: action2.actionId,
            label: action2.label,
            description: action2.description,
            effectSummary: action2.effectSummary,
            durationLabel: action2.durationMs > 0 ? formatDurationMs(action2.durationMs) : "Instant",
            cooldownLabel: cooldown.remainingMs > 0 ? `Cooldown ${formatDurationMs(cooldown.remainingMs)}` : formatDurationMs(action2.cooldownMs),
            cooldownRemainingMs: cooldown.remainingMs,
            cooldownEndsAtMs: cooldown.endsAtMs,
            heatLabel: `+${action2.heatGain}`,
            disabled: hasPendingCommand || !action2.enabled,
            disabledReason: hasPendingCommand ? "Command pending." : action2.disabledReason
          };
        }),
        actions: building2.actions.map((action2) => {
          const cooldown = createCooldownCountdown(action2.cooldownRemainingTicks, tickRateMs, nowMs);
          return {
            actionId: action2.actionId,
            label: action2.label,
            description: action2.description,
            inputSummary: formatResourceSummary(action2.inputCost, "Free"),
            outputSummary: formatResourceSummary(action2.outputGain, "No output"),
            cooldownLabel: cooldown.remainingMs > 0 ? `Cooldown ${formatDurationMs(cooldown.remainingMs)}` : `${Math.ceil(action2.cooldownMs / 1e3)}s cooldown`,
            cooldownRemainingMs: cooldown.remainingMs,
            cooldownEndsAtMs: cooldown.endsAtMs,
            heatLabel: `+${action2.heatGain}`,
            influenceLabel: formatSigned$1(action2.influenceChange),
            disabled: hasPendingCommand || !action2.enabled,
            disabledReason: hasPendingCommand ? "Command pending." : action2.disabledReason
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
  const PRODUCTION_GAME_LIFECYCLE_PHASES = {
    bootstrapping: "bootstrapping",
    live: "live",
    resolved: "resolved"
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
  const calculateTotalAttackPower = (loadout, strengthMultiplier = 1) => (calculateBaseAttackPower(loadout) + calculateSmgComboBonus(loadout)) * Math.max(0, Number(strengthMultiplier || 1));
  const calculateBaseDefensePower = (loadout, modifiers = {}) => Object.entries(loadout).reduce((totalPower, [weaponId, amount]) => {
    const normalizedAmount = Math.max(0, amount ?? 0);
    const defensePower = DEFENSE_POWER_BY_WEAPON[weaponId] ?? 0;
    const multiplier = Math.max(0, Number(modifiers[weaponId] ?? 1));
    return totalPower + normalizedAmount * defensePower * multiplier;
  }, 0);
  const hasSpyDetectionChance = (cameraCount) => cameraCount >= 5;
  const calculateTowerAttackReductionPercent = (towerCount) => Math.max(0, towerCount) * 0.3;
  const calculateReducedAttackPowerFromTowers = (attackPower, towerCount) => {
    const reductionPercent = calculateTowerAttackReductionPercent(towerCount);
    return Math.max(0, attackPower * (1 - reductionPercent / 100));
  };
  const resolveAttackDurationTicks = (context) => {
    var _a, _b;
    const configuredCooldownTicks = ((_a = context.config.balance.conflict) == null ? void 0 : _a.attackCooldownTicks) ?? 2;
    const configuredMinimumTicks = ((_b = context.config.balance.conflict) == null ? void 0 : _b.minAttackDurationTicks) ?? 0;
    const freeMinimumTicks = context.config.mode === "free" ? Math.ceil(1e3 * 60 * 3 / Math.max(1, context.config.tickRateMs)) : 0;
    return Math.max(1, configuredCooldownTicks, configuredMinimumTicks, freeMinimumTicks);
  };
  const ATTACK_LOSS_ORDER = [
    "baseball-bat",
    "pistol",
    "smg",
    "grenade",
    "bazooka"
  ];
  const DEFENSE_LOSS_ORDER = [
    "alarm",
    "cameras",
    "barricades",
    "vest",
    "defense-tower"
  ];
  const resolveCombat = (input) => {
    const outcomeTier = resolveOutcomeTier(input);
    const extraAttackerLosses = getExtraAttackerLosses(outcomeTier, input.attackLoadoutAfterTrap);
    const attackerLosses = mergeLosses(input.trapLosses, extraAttackerLosses);
    const defenderLosses = getDefenderLosses(outcomeTier, input.defenseLoadout);
    const districtCaptured = outcomeTier === "clean_capture" || outcomeTier === "costly_capture";
    const districtDamaged = outcomeTier === "costly_capture" || outcomeTier === "disaster";
    return {
      outcomeTier,
      legacyResult: toLegacyBattleResult(outcomeTier, input.trapBlocked, input.districtDestroyed),
      attackerLosses,
      defenderLosses,
      nextAttackerLoadout: applyLosses(input.attackLoadoutAfterTrap, extraAttackerLosses, ATTACK_LOSS_ORDER),
      nextDefenseLoadout: applyLosses(input.defenseLoadout, defenderLosses, DEFENSE_LOSS_ORDER),
      districtCaptured,
      districtDamaged,
      heatGained: Math.max(0, Math.floor(input.heatGain)),
      reportForAttacker: createAttackerReport(outcomeTier),
      reportForDefender: createDefenderReport(outcomeTier)
    };
  };
  const resolveOutcomeTier = (input) => {
    if (input.trapBlocked || input.districtDestroyed) {
      return "disaster";
    }
    if (input.effectiveAttackPower > input.effectiveDefensePower * 1.5) {
      return "clean_capture";
    }
    if (input.effectiveAttackPower > input.effectiveDefensePower) {
      return "costly_capture";
    }
    return "failed_raid";
  };
  const toLegacyBattleResult = (outcomeTier, trapBlocked, districtDestroyed) => {
    if (trapBlocked) {
      return "blocked";
    }
    if (districtDestroyed || outcomeTier === "disaster") {
      return "catastrophe";
    }
    return outcomeTier === "clean_capture" || outcomeTier === "costly_capture" ? "success" : "failure";
  };
  const getExtraAttackerLosses = (outcomeTier, loadout) => {
    if (outcomeTier === "clean_capture") {
      return {};
    }
    const lossCount = outcomeTier === "costly_capture" ? 1 : outcomeTier === "failed_raid" ? 2 : 3;
    return takeLosses(loadout, ATTACK_LOSS_ORDER, lossCount);
  };
  const getDefenderLosses = (outcomeTier, loadout) => {
    if (outcomeTier === "failed_raid") {
      return takeLosses(loadout, DEFENSE_LOSS_ORDER, 1);
    }
    if (outcomeTier === "clean_capture") {
      return takeLosses(loadout, DEFENSE_LOSS_ORDER, 2);
    }
    if (outcomeTier === "costly_capture") {
      return takeLosses(loadout, DEFENSE_LOSS_ORDER, 3);
    }
    return takeLosses(loadout, DEFENSE_LOSS_ORDER, 4);
  };
  const takeLosses = (loadout, order, lossCount) => {
    let remainingLosses = Math.max(0, Math.floor(lossCount));
    const losses = {};
    for (const key of order) {
      const available = Math.max(0, Number(loadout[key] ?? 0));
      const loss = Math.min(available, remainingLosses);
      if (loss > 0) {
        losses[key] = loss;
        remainingLosses -= loss;
      }
      if (remainingLosses <= 0) {
        break;
      }
    }
    return losses;
  };
  const mergeLosses = (left, right) => {
    const merged = { ...left };
    for (const [key, value] of Object.entries(right)) {
      merged[key] = Math.max(0, Number(merged[key] ?? 0) + Number(value ?? 0));
    }
    return merged;
  };
  const applyLosses = (loadout, losses, order) => {
    const nextLoadout = { ...loadout };
    for (const key of order) {
      const nextAmount = Math.max(0, Number(nextLoadout[key] ?? 0) - Number(losses[key] ?? 0));
      if (nextAmount > 0) {
        nextLoadout[key] = nextAmount;
      } else if (key in nextLoadout || Number(losses[key] ?? 0) > 0) {
        nextLoadout[key] = 0;
      } else {
        delete nextLoadout[key];
      }
    }
    return nextLoadout;
  };
  const createAttackerReport = (outcomeTier) => {
    switch (outcomeTier) {
      case "clean_capture":
        return "Attack resolved as a clean capture.";
      case "costly_capture":
        return "Attack captured the district, but losses were sustained.";
      case "failed_raid":
        return "Attack failed and the target district held.";
      case "disaster":
        return "Attack collapsed into a disaster.";
    }
  };
  const createDefenderReport = (outcomeTier) => {
    switch (outcomeTier) {
      case "clean_capture":
        return "Defense was overrun and the district was captured.";
      case "costly_capture":
        return "Defense inflicted losses but the district was captured.";
      case "failed_raid":
        return "Defense held and repelled the raid.";
      case "disaster":
        return "The attack triggered severe damage before ending.";
    }
  };
  const createPlayerPoliceState = (player, tick) => ({
    id: player.policeStateId,
    ownerPlayerId: player.id,
    heat: 0,
    wantedLevel: 0,
    lastDecayTick: tick,
    activeFlags: [],
    version: 1
  });
  const resolveWantedLevel = (heat) => Math.max(0, Math.min(5, Math.floor(Math.max(0, heat) / 20)));
  const increasePlayerPoliceHeat = (state, player, heatGain, tick) => {
    const currentPoliceState = state.policeStatesById[player.policeStateId] ?? createPlayerPoliceState(player, tick);
    const nextHeat = Math.max(0, Number(currentPoliceState.heat || 0) + Math.max(0, heatGain));
    return {
      ...currentPoliceState,
      heat: nextHeat,
      wantedLevel: resolveWantedLevel(nextHeat),
      version: currentPoliceState.version + (state.policeStatesById[currentPoliceState.id] ? 1 : 0)
    };
  };
  const getOwnedArcadeCount = (state, playerId, config) => getOwnedArcadeBuildings(state, playerId, config).length;
  const resolveArcadeNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraArcade / 100),
      launderingLimitMultiplier: Math.min(config.network.maxLaunderingLimitMultiplier, 1 + extra * config.network.launderingLimitBonusPctPerExtraArcade / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraArcade / 100)
    };
  };
  const getArcadeMetadata = (building2) => {
    var _a, _b;
    const raw = isRecord$9((_a = building2.metadata) == null ? void 0 : _a.arcade) ? (_b = building2.metadata) == null ? void 0 : _b.arcade : {};
    return {
      launderedEvents: Array.isArray(raw.launderedEvents) ? raw.launderedEvents.map((entry) => ({
        tick: Math.max(0, Math.floor(Number((entry == null ? void 0 : entry.tick) || 0))),
        amount: Math.max(0, Math.floor(Number((entry == null ? void 0 : entry.amount) || 0)))
      })).filter((entry) => entry.amount > 0) : [],
      auditRiskBonuses: Array.isArray(raw.auditRiskBonuses) ? raw.auditRiskBonuses.map((entry) => ({
        expiresAtTick: Math.max(0, Math.floor(Number((entry == null ? void 0 : entry.expiresAtTick) || 0))),
        riskPct: Math.max(0, Number((entry == null ? void 0 : entry.riskPct) || 0)),
        source: String((entry == null ? void 0 : entry.source) || "arcade")
      })).filter((entry) => entry.expiresAtTick > 0 && entry.riskPct > 0) : [],
      nightMachinesExpiresAtTick: asOptionalTick$7(raw.nightMachinesExpiresAtTick),
      incomePenaltyExpiresAtTick: asOptionalTick$7(raw.incomePenaltyExpiresAtTick),
      incomePenaltyPct: asOptionalNumber$3(raw.incomePenaltyPct),
      dirtyIncomePenaltyExpiresAtTick: asOptionalTick$7(raw.dirtyIncomePenaltyExpiresAtTick),
      dirtyIncomePenaltyPct: asOptionalNumber$3(raw.dirtyIncomePenaltyPct),
      backCashdeskBlockedUntilTick: asOptionalTick$7(raw.backCashdeskBlockedUntilTick),
      lastAuditCheckTick: asOptionalTick$7(raw.lastAuditCheckTick),
      auditLog: Array.isArray(raw.auditLog) ? raw.auditLog.filter(isRecord$9).slice(-10) : []
    };
  };
  const resolveArcadeAuditRisk = (input) => {
    const windowTicks = minutesToTicks$6(input.config.auditWindowMinutes, input.tickRateMs);
    const thresholdTick = Math.max(0, input.tick - windowTicks);
    const ownedBuildings = getOwnedArcadeBuildings(input.state, input.ownerPlayerId, input.config);
    const launderedInWindow = ownedBuildings.flatMap((building2) => getArcadeMetadata(building2).launderedEvents).filter((entry) => entry.tick >= thresholdTick).reduce((total, entry) => total + entry.amount, 0);
    const tier = input.config.auditRiskTiers.find(
      (candidate) => candidate.maxLaunderedAmount === null || launderedInWindow <= candidate.maxLaunderedAmount
    );
    let riskPct = (tier == null ? void 0 : tier.riskPct) ?? input.config.baseAuditRiskPct;
    riskPct += ownedBuildings.flatMap((building2) => getArcadeMetadata(building2).auditRiskBonuses).filter((bonus) => bonus.expiresAtTick > input.tick).reduce((total, bonus) => total + bonus.riskPct, 0);
    if (ownedBuildings.some((building2) => (getArcadeMetadata(building2).nightMachinesExpiresAtTick ?? 0) > input.tick)) {
      riskPct += input.config.nightMachines.auditRiskBonusPct;
    }
    if (ownedBuildings.length >= 12) {
      riskPct += 9;
    } else if (ownedBuildings.length >= 8) {
      riskPct += 5;
    }
    if (input.playerHeat > 180) {
      riskPct += 13;
    } else if (input.playerHeat > 100) {
      riskPct += 7;
    }
    return { riskPct: Math.max(0, Math.round(riskPct * 10) / 10), launderedInWindow, ownedCount: ownedBuildings.length };
  };
  const applyArcadeIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return { cleanPerHour: input.cleanPerHour, dirtyPerHour: input.dirtyPerHour, heatPerDay: input.heatPerDay, influencePerDay: input.influencePerDay };
    }
    const metadata = getArcadeMetadata(input.building);
    const network = resolveArcadeNetworkMultipliers(getOwnedArcadeCount(input.state, input.building.ownerPlayerId, input.config), input.config);
    const incomePenalty = (metadata.incomePenaltyExpiresAtTick ?? 0) > input.tick ? 1 - Math.max(0, Number(metadata.incomePenaltyPct || 0)) / 100 : 1;
    const dirtyPenalty = (metadata.dirtyIncomePenaltyExpiresAtTick ?? 0) > input.tick ? 1 - Math.max(0, Number(metadata.dirtyIncomePenaltyPct || 0)) / 100 : 1;
    const nightActive = (metadata.nightMachinesExpiresAtTick ?? 0) > input.tick;
    return {
      cleanPerHour: input.cleanPerHour * network.incomeMultiplier * incomePenalty * (nightActive ? 1 + input.config.nightMachines.cleanIncomeBonusPct / 100 : 1),
      dirtyPerHour: input.dirtyPerHour * network.incomeMultiplier * incomePenalty * dirtyPenalty * (nightActive ? 1 + input.config.nightMachines.dirtyIncomeBonusPct / 100 : 1),
      heatPerDay: input.heatPerDay * network.heatMultiplier * (nightActive ? 1 + input.config.nightMachines.heatBonusPct / 100 : 1),
      influencePerDay: input.influencePerDay * (nightActive ? 1 + input.config.nightMachines.influenceBonusPct / 100 : 1)
    };
  };
  const resolveArcadeAction = (input) => {
    if (input.action.actionId === input.arcadeConfig.nightMachines.actionId) {
      return resolveNightMachines(input);
    }
    if (input.action.actionId === input.arcadeConfig.backCashdesk.actionId) {
      return resolveBackCashdesk(input);
    }
    return null;
  };
  const validateArcadeAction = (input) => {
    const config = input.arcadeConfig;
    if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
    const metadata = getArcadeMetadata(input.building);
    if (input.actionId === config.nightMachines.actionId && (metadata.nightMachinesExpiresAtTick ?? 0) > input.state.root.tick) {
      return "arcade_night_machines_active";
    }
    if (input.actionId === config.backCashdesk.actionId) {
      if ((metadata.backCashdeskBlockedUntilTick ?? 0) > input.state.root.tick) return "arcade_back_cashdesk_blocked";
      if (Math.max(0, Number(input.balances["dirty-cash"] || 0)) < config.backCashdesk.minimumDirtyCash) return "arcade_insufficient_dirty_cash";
    }
    return null;
  };
  const applyArcadeAuditChecks = (state, config, tickRateMs) => {
    var _a;
    const checkEveryTicks = minutesToTicks$6(config.auditCheckEveryMinutes, tickRateMs);
    let buildingsById = state.buildingsById;
    let districtsById = state.districtsById;
    let resourceStatesById = state.resourceStatesById;
    let policeStatesById = state.policeStatesById;
    let changed = false;
    for (const building2 of Object.values(state.buildingsById)) {
      if (building2.buildingTypeId !== config.buildingTypeId || building2.status !== "active" || !building2.ownerPlayerId) continue;
      const metadata = cleanupArcadeMetadata(getArcadeMetadata(building2), state.root.tick);
      if ((metadata.lastAuditCheckTick ?? -Infinity) + checkEveryTicks > state.root.tick) continue;
      if (metadata.lastAuditCheckTick === void 0) {
        metadata.lastAuditCheckTick = state.root.tick;
        buildingsById = { ...buildingsById, [building2.id]: { ...building2, metadata: withArcadeMetadata(building2, metadata), version: building2.version + 1 } };
        changed = true;
        continue;
      }
      const player = state.playersById[building2.ownerPlayerId];
      const district = state.districtsById[building2.districtId];
      if (!player || !district) continue;
      const playerHeat = Math.max(0, Number(((_a = policeStatesById[player.policeStateId]) == null ? void 0 : _a.heat) ?? district.heat ?? 0));
      const risk = resolveArcadeAuditRisk({ config, state: { ...state, buildingsById }, ownerPlayerId: player.id, playerHeat, tick: state.root.tick, tickRateMs });
      const triggered = deterministicRollPct$5(`${building2.id}:arcade-audit:${state.root.tick}`) < risk.riskPct;
      metadata.lastAuditCheckTick = state.root.tick;
      if (triggered) {
        const consequence = resolveAuditConsequence$2(building2.id, state.root.tick);
        metadata.auditLog = [...metadata.auditLog || [], { tick: state.root.tick, consequence, riskPct: risk.riskPct, launderedInWindow: risk.launderedInWindow }].slice(-10);
        const owned = getOwnedArcadeBuildings({ ...state, buildingsById }, player.id, config);
        if (consequence === "machineInspection") {
          buildingsById = applyMetadataToOwnedArcades(buildingsById, owned, (entry) => ({ ...entry, incomePenaltyPct: config.auditConsequences.machineInspection.incomePenaltyPct, incomePenaltyExpiresAtTick: state.root.tick + minutesToTicks$6(config.auditConsequences.machineInspection.durationMinutes, tickRateMs) }));
        } else if (consequence === "seizedMachine") {
          buildingsById = applyMetadataToOwnedArcades(buildingsById, owned, (entry) => ({ ...entry, dirtyIncomePenaltyPct: config.auditConsequences.seizedMachine.dirtyIncomePenaltyPct, dirtyIncomePenaltyExpiresAtTick: state.root.tick + minutesToTicks$6(config.auditConsequences.seizedMachine.durationMinutes, tickRateMs) }));
        } else if (consequence === "closedBackRoom") {
          buildingsById = applyMetadataToOwnedArcades(buildingsById, owned, (entry) => ({ ...entry, backCashdeskBlockedUntilTick: state.root.tick + minutesToTicks$6(config.auditConsequences.closedBackRoom.actionBlockedMinutes, tickRateMs) }));
        } else if (consequence === "operatingFine") {
          const current = resourceStatesById[player.resourceStateId];
          if (current) resourceStatesById = { ...resourceStatesById, [current.id]: { ...current, balances: { ...current.balances, cash: Math.max(0, Number(current.balances.cash || 0) - config.auditConsequences.operatingFine.cleanCashLoss) }, version: current.version + 1 } };
        } else if (consequence === "localRaid") {
          districtsById = { ...districtsById, [district.id]: { ...district, heat: Math.max(0, Number(district.heat || 0) + config.auditConsequences.localRaid.heatGain), version: district.version + 1 } };
          const policeState = policeStatesById[player.policeStateId] ?? createPlayerPoliceState(player, state.root.tick);
          const heat = Math.max(0, Number(policeState.heat || 0) + config.auditConsequences.localRaid.heatGain);
          policeStatesById = { ...policeStatesById, [policeState.id]: { ...policeState, heat, wantedLevel: resolveWantedLevel(heat), version: policeState.version + (policeStatesById[policeState.id] ? 1 : 0) } };
        }
      }
      const currentMetadata = getArcadeMetadata(buildingsById[building2.id] ?? building2);
      const finalMetadata = { ...currentMetadata, launderedEvents: metadata.launderedEvents, auditRiskBonuses: metadata.auditRiskBonuses, lastAuditCheckTick: metadata.lastAuditCheckTick, auditLog: metadata.auditLog };
      buildingsById = { ...buildingsById, [building2.id]: { ...building2, metadata: withArcadeMetadata(building2, finalMetadata), version: building2.version + 1 } };
      changed = true;
    }
    return changed ? { ...state, buildingsById, districtsById, resourceStatesById, policeStatesById } : state;
  };
  const resolveNightMachines = (input) => {
    const metadata = cleanupArcadeMetadata(getArcadeMetadata(input.building), input.state.root.tick);
    metadata.nightMachinesExpiresAtTick = input.state.root.tick + minutesToTicks$6(input.arcadeConfig.nightMachines.durationMinutes, input.tickRateMs);
    return {
      balances: { ...input.balances },
      buildingMetadata: withArcadeMetadata(input.building, metadata),
      heatGain: 0,
      influenceChange: 0,
      inputCost: {},
      outputGain: {},
      effectModifiers: input.action.effectModifiers,
      reportText: `Noční automaty aktivní ${input.arcadeConfig.nightMachines.durationMinutes} minut.`,
      arcadeResult: { type: "temporary_boost", activeUntilTick: metadata.nightMachinesExpiresAtTick, durationMinutes: input.arcadeConfig.nightMachines.durationMinutes, auditRiskBonusPct: input.arcadeConfig.nightMachines.auditRiskBonusPct }
    };
  };
  const resolveBackCashdesk = (input) => {
    const metadata = cleanupArcadeMetadata(getArcadeMetadata(input.building), input.state.root.tick);
    const dirtyCash = Math.max(0, Math.floor(Number(input.balances["dirty-cash"] || 0)));
    const ownedCount = input.building.ownerPlayerId ? getOwnedArcadeCount(input.state, input.building.ownerPlayerId, input.arcadeConfig) : 1;
    const network = resolveArcadeNetworkMultipliers(ownedCount, input.arcadeConfig);
    const amount = Math.min(Math.floor(dirtyCash * input.arcadeConfig.backCashdesk.dirtyCashSharePct / 100), Math.floor(input.arcadeConfig.backCashdesk.maxDirtyCashPerAction * network.launderingLimitMultiplier));
    const fee = Math.floor(amount * input.arcadeConfig.backCashdesk.feePct / 100);
    const cleanGain = Math.max(0, amount - fee);
    metadata.launderedEvents.push({ tick: input.state.root.tick, amount });
    metadata.auditRiskBonuses.push({ expiresAtTick: input.state.root.tick + minutesToTicks$6(input.arcadeConfig.backCashdesk.auditRiskDurationMinutes, input.tickRateMs), riskPct: input.arcadeConfig.backCashdesk.auditRiskBonusPct, source: input.arcadeConfig.backCashdesk.actionId });
    return {
      balances: { ...input.balances, "dirty-cash": Math.max(0, dirtyCash - amount), cash: Math.max(0, Number(input.balances.cash || 0) + cleanGain) },
      buildingMetadata: withArcadeMetadata(input.building, metadata),
      heatGain: input.arcadeConfig.backCashdesk.heatGain,
      influenceChange: input.arcadeConfig.backCashdesk.influenceGain,
      inputCost: { "dirty-cash": amount },
      outputGain: { cash: cleanGain },
      reportText: `Zadní pokladna vyprala ${amount} dirty cash na ${cleanGain} clean cash. Poplatek ${fee}. Heat +${input.arcadeConfig.backCashdesk.heatGain}.`,
      arcadeResult: { type: "laundering", launderedDirtyCash: amount, cleanCashGained: cleanGain, feePaid: fee, heatGain: input.arcadeConfig.backCashdesk.heatGain, influenceGain: input.arcadeConfig.backCashdesk.influenceGain, ownedArcades: ownedCount, networkMultiplier: network }
    };
  };
  const getOwnedArcadeBuildings = (state, playerId, config) => Object.values(state.buildingsById).filter((building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active");
  const applyMetadataToOwnedArcades = (buildingsById, buildings, update) => {
    let next = buildingsById;
    for (const building2 of buildings) {
      const metadata = update(getArcadeMetadata(building2));
      next = { ...next, [building2.id]: { ...building2, metadata: withArcadeMetadata(building2, metadata), version: building2.version + 1 } };
    }
    return next;
  };
  const resolveAuditConsequence$2 = (buildingId, tick) => {
    const roll = Math.floor(deterministicRollPct$5(`${buildingId}:arcade-audit-consequence:${tick}`) / 20);
    return ["machineInspection", "seizedMachine", "closedBackRoom", "operatingFine", "localRaid"][Math.max(0, Math.min(4, roll))];
  };
  const cleanupArcadeMetadata = (metadata, tick) => ({ ...metadata, auditRiskBonuses: metadata.auditRiskBonuses.filter((bonus) => bonus.expiresAtTick > tick), auditLog: (metadata.auditLog || []).slice(-10) });
  const withArcadeMetadata = (building2, arcade) => ({ ...building2.metadata ?? {}, arcade });
  const minutesToTicks$6 = (minutes, tickRateMs) => Math.max(1, Math.ceil(Math.max(0, Number(minutes || 0)) * 60 * 1e3 / Math.max(1, tickRateMs)));
  const deterministicRollPct$5 = (seed) => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 1e4 / 100;
  };
  const asOptionalTick$7 = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : void 0;
  };
  const asOptionalNumber$3 = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : void 0;
  };
  const isRecord$9 = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const isCasinoAction = (actionId, config) => Boolean(config && [
    config.quietBackroom.actionId,
    config.vipNight.actionId,
    config.bribedInspector.actionId
  ].includes(actionId));
  const getCasinoMetadata = (building2) => {
    var _a, _b;
    const raw = isRecord$8((_a = building2.metadata) == null ? void 0 : _a.casino) ? (_b = building2.metadata) == null ? void 0 : _b.casino : {};
    return {
      launderedEvents: Array.isArray(raw.launderedEvents) ? raw.launderedEvents.map((entry) => ({
        tick: Math.max(0, Math.floor(Number((entry == null ? void 0 : entry.tick) || 0))),
        amount: Math.max(0, Math.floor(Number((entry == null ? void 0 : entry.amount) || 0)))
      })).filter((entry) => entry.amount > 0) : [],
      auditRiskBonuses: Array.isArray(raw.auditRiskBonuses) ? raw.auditRiskBonuses.map((entry) => ({
        expiresAtTick: Math.max(0, Math.floor(Number((entry == null ? void 0 : entry.expiresAtTick) || 0))),
        riskPct: Math.max(0, Number((entry == null ? void 0 : entry.riskPct) || 0)),
        source: String((entry == null ? void 0 : entry.source) || "casino")
      })).filter((entry) => entry.expiresAtTick > 0 && entry.riskPct > 0) : [],
      vipNightExpiresAtTick: asOptionalTick$6(raw.vipNightExpiresAtTick),
      bribedInspectorExpiresAtTick: asOptionalTick$6(raw.bribedInspectorExpiresAtTick),
      incomePenaltyExpiresAtTick: asOptionalTick$6(raw.incomePenaltyExpiresAtTick),
      incomePenaltyPct: asOptionalNumber$2(raw.incomePenaltyPct),
      launderingBlockedUntilTick: asOptionalTick$6(raw.launderingBlockedUntilTick),
      vipBlockedUntilTick: asOptionalTick$6(raw.vipBlockedUntilTick),
      lastAuditCheckTick: asOptionalTick$6(raw.lastAuditCheckTick),
      auditLog: Array.isArray(raw.auditLog) ? raw.auditLog.filter(isRecord$8).slice(-10) : []
    };
  };
  const resolveCasinoAuditRisk = (input) => {
    const metadata = getCasinoMetadata(input.building);
    const windowTicks = minutesToTicks$5(input.config.auditWindowMinutes, input.tickRateMs);
    const thresholdTick = Math.max(0, input.tick - windowTicks);
    const launderedInWindow = metadata.launderedEvents.filter((entry) => entry.tick >= thresholdTick).reduce((total, entry) => total + entry.amount, 0);
    const tier = input.config.auditRiskTiers.find(
      (candidate) => candidate.maxLaunderedAmount === null || launderedInWindow <= candidate.maxLaunderedAmount
    );
    let riskPct = (tier == null ? void 0 : tier.riskPct) ?? input.config.baseAuditRiskPct;
    riskPct += metadata.auditRiskBonuses.filter((bonus) => bonus.expiresAtTick > input.tick).reduce((total, bonus) => total + bonus.riskPct, 0);
    if ((metadata.vipNightExpiresAtTick ?? 0) > input.tick) {
      riskPct += input.config.vipNight.auditRiskBonusPct;
    }
    if (input.playerHeat > 180) {
      riskPct += 20;
    } else if (input.playerHeat > 100) {
      riskPct += 10;
    }
    if ((metadata.bribedInspectorExpiresAtTick ?? 0) > input.tick) {
      riskPct *= 1 - input.config.bribedInspector.successAuditRiskReductionPct / 100;
    }
    return {
      riskPct: Math.max(0, Math.round(riskPct * 10) / 10),
      launderedInWindow
    };
  };
  const applyCasinoIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId) {
      return input;
    }
    const metadata = getCasinoMetadata(input.building);
    const upgrade = getCasinoUpgrade(input.config, input.building.level);
    const incomeMultiplier = 1 + upgrade.incomeBonusPct / 100;
    const penaltyMultiplier = (metadata.incomePenaltyExpiresAtTick ?? 0) > input.tick ? 1 - Math.max(0, Number(metadata.incomePenaltyPct || 0)) / 100 : 1;
    const vipCleanMultiplier = (metadata.vipNightExpiresAtTick ?? 0) > input.tick ? 1 + input.config.vipNight.cleanIncomeBonusPct / 100 : 1;
    const vipDirtyMultiplier = (metadata.vipNightExpiresAtTick ?? 0) > input.tick ? 1 + input.config.vipNight.dirtyIncomeBonusPct / 100 : 1;
    const vipHeatMultiplier = (metadata.vipNightExpiresAtTick ?? 0) > input.tick ? 1 + input.config.vipNight.heatBonusPct / 100 : 1;
    const vipInfluenceMultiplier = (metadata.vipNightExpiresAtTick ?? 0) > input.tick ? 1 + input.config.vipNight.influenceBonusPct / 100 : 1;
    return {
      cleanPerHour: input.cleanPerHour * incomeMultiplier * penaltyMultiplier * vipCleanMultiplier,
      dirtyPerHour: input.dirtyPerHour * incomeMultiplier * penaltyMultiplier * vipDirtyMultiplier,
      heatPerDay: input.heatPerDay * vipHeatMultiplier,
      influencePerDay: input.influencePerDay * vipInfluenceMultiplier
    };
  };
  const resolveCasinoAction = (input) => {
    if (input.action.actionId === input.casinoConfig.quietBackroom.actionId) {
      return resolveQuietBackroom(input);
    }
    if (input.action.actionId === input.casinoConfig.vipNight.actionId) {
      return resolveVipNight(input);
    }
    if (input.action.actionId === input.casinoConfig.bribedInspector.actionId) {
      return resolveBribedInspector(input);
    }
    return null;
  };
  const validateCasinoAction = (input) => {
    const config = input.casinoConfig;
    if (!config || input.building.buildingTypeId !== config.buildingTypeId || !isCasinoAction(input.actionId, config)) {
      return null;
    }
    const metadata = getCasinoMetadata(input.building);
    if (input.actionId === config.quietBackroom.actionId) {
      if ((metadata.launderingBlockedUntilTick ?? 0) > input.state.root.tick) {
        return "casino_laundering_blocked";
      }
      if (Math.max(0, Number(input.balances["dirty-cash"] || 0)) < config.quietBackroom.minimumDirtyCash) {
        return "casino_insufficient_dirty_cash";
      }
    }
    if (input.actionId === config.vipNight.actionId) {
      if ((metadata.vipNightExpiresAtTick ?? 0) > input.state.root.tick) {
        return "casino_vip_night_active";
      }
      if ((metadata.vipBlockedUntilTick ?? 0) > input.state.root.tick) {
        return "casino_vip_lounge_closed";
      }
    }
    return null;
  };
  const applyCasinoAuditChecks = (state, casinoConfig, tickRateMs) => {
    var _a;
    const checkEveryTicks = minutesToTicks$5(casinoConfig.auditCheckEveryMinutes, tickRateMs);
    let nextState = state;
    let buildingsById = state.buildingsById;
    let districtsById = state.districtsById;
    let resourceStatesById = state.resourceStatesById;
    let policeStatesById = state.policeStatesById;
    let changed = false;
    for (const building2 of Object.values(state.buildingsById)) {
      if (building2.buildingTypeId !== casinoConfig.buildingTypeId || building2.status !== "active" || !building2.ownerPlayerId) {
        continue;
      }
      const metadata = cleanupCasinoMetadata(getCasinoMetadata(building2), state.root.tick);
      if ((metadata.lastAuditCheckTick ?? -Infinity) + checkEveryTicks > state.root.tick) {
        continue;
      }
      if (metadata.lastAuditCheckTick === void 0) {
        metadata.lastAuditCheckTick = state.root.tick;
        buildingsById = {
          ...buildingsById,
          [building2.id]: {
            ...building2,
            metadata: withCasinoMetadata(building2, metadata),
            version: building2.version + 1
          }
        };
        changed = true;
        continue;
      }
      const player = state.playersById[building2.ownerPlayerId];
      const district = state.districtsById[building2.districtId];
      if (!player || !district) {
        continue;
      }
      const playerHeat = Math.max(0, Number(((_a = policeStatesById[player.policeStateId]) == null ? void 0 : _a.heat) ?? district.heat ?? 0));
      const risk = resolveCasinoAuditRisk({
        config: casinoConfig,
        building: {
          ...building2,
          metadata: withCasinoMetadata(building2, metadata)
        },
        playerHeat,
        tick: state.root.tick,
        tickRateMs
      });
      const triggered = deterministicRollPct$4(`${building2.id}:audit:${state.root.tick}`) < risk.riskPct;
      metadata.lastAuditCheckTick = state.root.tick;
      if (triggered) {
        const consequence = resolveAuditConsequence$1(building2.id, state.root.tick);
        metadata.auditLog = [
          ...metadata.auditLog || [],
          { tick: state.root.tick, consequence, riskPct: risk.riskPct, launderedInWindow: risk.launderedInWindow }
        ].slice(-10);
        if (consequence === "lightInspection") {
          metadata.incomePenaltyPct = casinoConfig.auditConsequences.lightInspection.incomePenaltyPct;
          metadata.incomePenaltyExpiresAtTick = state.root.tick + minutesToTicks$5(casinoConfig.auditConsequences.lightInspection.durationMinutes, tickRateMs);
        } else if (consequence === "seizedBooks") {
          const current = resourceStatesById[player.resourceStateId];
          const dirtyCash = Math.max(0, Number((current == null ? void 0 : current.balances["dirty-cash"]) || 0));
          const loss = Math.floor(dirtyCash * casinoConfig.auditConsequences.seizedBooks.dirtyCashLossPct / 100);
          if (current && loss > 0) {
            resourceStatesById = {
              ...resourceStatesById,
              [current.id]: {
                ...current,
                balances: {
                  ...current.balances,
                  "dirty-cash": Math.max(0, dirtyCash - loss)
                },
                version: current.version + 1
              }
            };
          }
        } else if (consequence === "frozenAccounts") {
          metadata.launderingBlockedUntilTick = state.root.tick + minutesToTicks$5(casinoConfig.auditConsequences.frozenAccounts.launderingBlockedMinutes, tickRateMs);
        } else if (consequence === "policeRaid") {
          metadata.incomePenaltyPct = casinoConfig.auditConsequences.policeRaid.incomePenaltyPct;
          metadata.incomePenaltyExpiresAtTick = state.root.tick + minutesToTicks$5(casinoConfig.auditConsequences.policeRaid.durationMinutes, tickRateMs);
          districtsById = {
            ...districtsById,
            [district.id]: {
              ...district,
              heat: Math.max(0, Number(district.heat || 0) + casinoConfig.auditConsequences.policeRaid.heatGain),
              version: district.version + 1
            }
          };
          const policeState = policeStatesById[player.policeStateId];
          if (policeState) {
            policeStatesById = {
              ...policeStatesById,
              [policeState.id]: {
                ...policeState,
                heat: Math.max(0, Number(policeState.heat || 0) + casinoConfig.auditConsequences.policeRaid.heatGain),
                version: policeState.version + 1
              }
            };
          }
        } else if (consequence === "closedVipLounge") {
          metadata.vipBlockedUntilTick = state.root.tick + minutesToTicks$5(casinoConfig.auditConsequences.closedVipLounge.vipBlockedMinutes, tickRateMs);
        }
      }
      buildingsById = {
        ...buildingsById,
        [building2.id]: {
          ...building2,
          metadata: withCasinoMetadata(building2, metadata),
          version: building2.version + 1
        }
      };
      changed = true;
    }
    if (!changed) {
      return state;
    }
    nextState = {
      ...nextState,
      buildingsById,
      districtsById,
      resourceStatesById,
      policeStatesById
    };
    return nextState;
  };
  const resolveAuditConsequence$1 = (buildingId, tick) => {
    const roll = Math.floor(deterministicRollPct$4(`${buildingId}:audit-consequence:${tick}`) / 20);
    return ["lightInspection", "seizedBooks", "frozenAccounts", "policeRaid", "closedVipLounge"][Math.max(0, Math.min(4, roll))];
  };
  const resolveQuietBackroom = (input) => {
    const config = input.casinoConfig;
    const metadata = cleanupCasinoMetadata(getCasinoMetadata(input.building), input.state.root.tick);
    const dirtyCash = Math.max(0, Math.floor(Number(input.balances["dirty-cash"] || 0)));
    const upgrade = getCasinoUpgrade(config, input.building.level);
    const capacity = Math.floor(config.launderingCapacity * (1 + upgrade.launderingLimitBonusPct / 100));
    const amount = Math.min(Math.floor(dirtyCash * config.quietBackroom.dirtyCashSharePct / 100), config.quietBackroom.maxDirtyCashPerAction, capacity);
    const feePct = Math.max(0, config.quietBackroom.feePct - (upgrade.feeReductionPct ?? 0));
    const fee = Math.floor(amount * feePct / 100);
    const cleanGain = Math.max(0, amount - fee);
    const heatGain = reduceCasinoActionHeat(config.quietBackroom.heatGain, upgrade);
    const nextBalances = {
      ...input.balances,
      "dirty-cash": Math.max(0, dirtyCash - amount),
      cash: Math.max(0, Number(input.balances.cash || 0) + cleanGain)
    };
    metadata.launderedEvents.push({ tick: input.state.root.tick, amount });
    metadata.auditRiskBonuses.push({
      expiresAtTick: input.state.root.tick + minutesToTicks$5(config.quietBackroom.auditRiskDurationMinutes, input.tickRateMs),
      riskPct: config.quietBackroom.auditRiskBonusPct,
      source: config.quietBackroom.actionId
    });
    return {
      balances: nextBalances,
      buildingMetadata: withCasinoMetadata(input.building, metadata),
      heatGain,
      influenceChange: config.quietBackroom.influenceGain,
      inputCost: { "dirty-cash": amount },
      outputGain: { cash: cleanGain },
      reportText: `Tichá herna vyprala ${amount} dirty cash na ${cleanGain} clean cash. Poplatek ${fee}. Heat +${heatGain}.`,
      casinoResult: {
        type: "laundering",
        launderedDirtyCash: amount,
        cleanCashGained: cleanGain,
        feePaid: fee,
        heatGain,
        influenceGain: config.quietBackroom.influenceGain
      }
    };
  };
  const resolveVipNight = (input) => {
    const config = input.casinoConfig;
    const metadata = cleanupCasinoMetadata(getCasinoMetadata(input.building), input.state.root.tick);
    metadata.vipNightExpiresAtTick = input.state.root.tick + minutesToTicks$5(config.vipNight.durationMinutes, input.tickRateMs);
    return {
      balances: { ...input.balances },
      buildingMetadata: withCasinoMetadata(input.building, metadata),
      heatGain: 0,
      influenceChange: 0,
      inputCost: {},
      outputGain: {},
      effectModifiers: {
        cleanIncomeMultiplier: 1 + config.vipNight.cleanIncomeBonusPct / 100,
        dirtyIncomeMultiplier: 1 + config.vipNight.dirtyIncomeBonusPct / 100,
        influenceMultiplier: 1 + config.vipNight.influenceBonusPct / 100,
        heatMultiplier: 1 + config.vipNight.heatBonusPct / 100
      },
      reportText: `VIP noc aktivní ${config.vipNight.durationMinutes} minut. Income, vliv, heat i audit risk jsou zvýšené.`,
      casinoResult: {
        type: "temporary_boost",
        activeUntilTick: metadata.vipNightExpiresAtTick,
        durationMinutes: config.vipNight.durationMinutes,
        auditRiskBonusPct: config.vipNight.auditRiskBonusPct
      }
    };
  };
  const resolveBribedInspector = (input) => {
    const config = input.casinoConfig;
    const metadata = cleanupCasinoMetadata(getCasinoMetadata(input.building), input.state.root.tick);
    const cleanCash = Math.max(0, Number(input.balances.cash || 0));
    const failed = deterministicRollPct$4(`${input.commandId}:${input.state.root.tick}`) < config.bribedInspector.failureChancePct;
    const nextBalances = {
      ...input.balances,
      cash: Math.max(0, cleanCash - config.bribedInspector.cleanCashCost)
    };
    if (failed) {
      metadata.auditRiskBonuses.push({
        expiresAtTick: input.state.root.tick + minutesToTicks$5(config.bribedInspector.failureAuditRiskDurationMinutes, input.tickRateMs),
        riskPct: config.bribedInspector.failureAuditRiskBonusPct,
        source: config.bribedInspector.actionId
      });
      return {
        balances: nextBalances,
        buildingMetadata: withCasinoMetadata(input.building, metadata),
        heatGain: config.bribedInspector.failureHeatGain,
        influenceChange: 0,
        inputCost: { cash: config.bribedInspector.cleanCashCost },
        outputGain: {},
        reportText: `Podplacený inspektor selhal. Cena propadla, heat +${config.bribedInspector.failureHeatGain}, audit risk +${config.bribedInspector.failureAuditRiskBonusPct} %.`,
        casinoResult: {
          type: "heat_control",
          success: false,
          costPaid: config.bribedInspector.cleanCashCost,
          heatGain: config.bribedInspector.failureHeatGain,
          auditRiskBonusPct: config.bribedInspector.failureAuditRiskBonusPct
        }
      };
    }
    metadata.bribedInspectorExpiresAtTick = input.state.root.tick + minutesToTicks$5(config.bribedInspector.protectionMinutes, input.tickRateMs);
    return {
      balances: nextBalances,
      buildingMetadata: withCasinoMetadata(input.building, metadata),
      heatGain: -config.bribedInspector.successHeatReduction,
      influenceChange: config.bribedInspector.successInfluenceGain,
      inputCost: { cash: config.bribedInspector.cleanCashCost },
      outputGain: {},
      reportText: `Podplacený inspektor uspěl. Heat -${config.bribedInspector.successHeatReduction}, audit risk relativně -${config.bribedInspector.successAuditRiskReductionPct} %.`,
      casinoResult: {
        type: "heat_control",
        success: true,
        costPaid: config.bribedInspector.cleanCashCost,
        heatReduction: config.bribedInspector.successHeatReduction,
        influenceGain: config.bribedInspector.successInfluenceGain,
        auditRiskReductionPct: config.bribedInspector.successAuditRiskReductionPct
      }
    };
  };
  const cleanupCasinoMetadata = (metadata, tick) => ({
    ...metadata,
    auditRiskBonuses: metadata.auditRiskBonuses.filter((bonus) => bonus.expiresAtTick > tick),
    auditLog: (metadata.auditLog || []).slice(-10)
  });
  const withCasinoMetadata = (building2, casino) => ({
    ...building2.metadata ?? {},
    casino
  });
  const getCasinoUpgrade = (config, level) => {
    const safeLevel = Math.max(1, Math.floor(Number(level || 1)));
    return [...config.upgrades].sort((a, b) => b.level - a.level).find((upgrade) => upgrade.level <= safeLevel) ?? config.upgrades[0];
  };
  const reduceCasinoActionHeat = (heatGain, upgrade) => Math.floor(Number(heatGain || 0) * (1 - Math.max(0, Number(upgrade.actionHeatReductionPct || 0)) / 100));
  const minutesToTicks$5 = (minutes, tickRateMs) => Math.max(1, Math.ceil(Math.max(0, Number(minutes || 0)) * 60 * 1e3 / Math.max(1, tickRateMs)));
  const deterministicRollPct$4 = (seed) => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 1e4 / 100;
  };
  const asOptionalTick$6 = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : void 0;
  };
  const asOptionalNumber$2 = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : void 0;
  };
  const isRecord$8 = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const INCOME_TARGET_BY_BUILDING_TYPE = {
    casino: "casinoIncome",
    arcade: "arcadeIncome",
    exchange: "exchangeIncome",
    strip_club: "stripClubIncome"
  };
  const getOwnedPowerStationCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolvePowerStationNetworkMultipliers = (count, config) => {
    const safeCount = Math.max(0, Math.floor(Number(count || 0)));
    const extra = Math.max(0, safeCount - 1);
    return {
      infrastructureBonusPct: Math.min(config.infrastructure.maxBonusPct, safeCount * config.infrastructure.bonusPctPerStation),
      incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraStation / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraStation / 100),
      cameraStrengthBonusPct: Math.min(config.defense.maxCameraStrengthBonusPct, safeCount * config.defense.cameraStrengthBonusPctPerStation),
      alarmStrengthBonusPct: Math.min(config.defense.maxAlarmStrengthBonusPct, safeCount * config.defense.alarmStrengthBonusPctPerStation)
    };
  };
  const getPowerStationMetadata = (building2) => {
    var _a;
    const raw = isRecord$7((_a = building2.metadata) == null ? void 0 : _a.powerStation) ? building2.metadata.powerStation : {};
    return {
      backupGridSwitchExpiresAtTick: asOptionalTick$5(raw.backupGridSwitchExpiresAtTick)
    };
  };
  const isPowerStationBackupGridActiveForPlayer = (state, playerId, config, tick) => Object.values(state.buildingsById).some(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active" && (getPowerStationMetadata(building2).backupGridSwitchExpiresAtTick ?? 0) > tick
  );
  const resolvePowerStationInfrastructureBonusPct = (input) => {
    if (!input.config || !input.playerId) {
      return 0;
    }
    const base = resolvePowerStationNetworkMultipliers(
      getOwnedPowerStationCount(input.state, input.playerId, input.config),
      input.config
    ).infrastructureBonusPct;
    const temporary = isPowerStationBackupGridActiveForPlayer(input.state, input.playerId, input.config, input.tick) ? input.config.backupGridSwitch.temporaryInfrastructureBonusPct : 0;
    return Math.max(0, base + temporary);
  };
  const resolvePowerStationInfrastructureMultiplier = (input) => {
    if (!input.config || !input.playerId) {
      return 1;
    }
    const infrastructureBonusPct = resolvePowerStationInfrastructureBonusPct(input);
    const weightedBonusPct = infrastructureBonusPct * input.config.infrastructure.weights[input.target];
    const directBonusPct = isPowerStationBackupGridActiveForPlayer(input.state, input.playerId, input.config, input.tick) ? resolveBackupDirectBonusPct(input.config, input.target) : 0;
    return 1 + (weightedBonusPct + directBonusPct) / 100;
  };
  const resolvePowerStationDefenseBonuses = (input) => {
    if (!input.config || !input.playerId) {
      return { cameraStrengthBonusPct: 0, alarmStrengthBonusPct: 0 };
    }
    const network = resolvePowerStationNetworkMultipliers(
      getOwnedPowerStationCount(input.state, input.playerId, input.config),
      input.config
    );
    const backupActive = isPowerStationBackupGridActiveForPlayer(input.state, input.playerId, input.config, input.tick);
    return {
      cameraStrengthBonusPct: network.cameraStrengthBonusPct + (backupActive ? input.config.backupGridSwitch.cameraStrengthBonusPct : 0),
      alarmStrengthBonusPct: network.alarmStrengthBonusPct + (backupActive ? input.config.backupGridSwitch.alarmStrengthBonusPct : 0)
    };
  };
  const applyPowerStationIncomeModifiers = (input) => {
    if (!input.building.ownerPlayerId) {
      return {
        cleanPerHour: input.cleanPerHour,
        dirtyPerHour: input.dirtyPerHour,
        heatPerDay: input.heatPerDay,
        influencePerDay: input.influencePerDay,
        maxLevel: 1
      };
    }
    if (input.building.buildingTypeId === input.config.buildingTypeId) {
      const network = resolvePowerStationNetworkMultipliers(
        getOwnedPowerStationCount(input.state, input.building.ownerPlayerId, input.config),
        input.config
      );
      return {
        cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
        dirtyPerHour: 0,
        heatPerDay: input.heatPerDay * network.heatMultiplier,
        influencePerDay: 0,
        maxLevel: 1
      };
    }
    const target = INCOME_TARGET_BY_BUILDING_TYPE[input.building.buildingTypeId];
    const infrastructureMultiplier = target ? resolvePowerStationInfrastructureMultiplier({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.config,
      tick: input.tick,
      target
    }) : 1;
    return {
      cleanPerHour: input.cleanPerHour * infrastructureMultiplier,
      dirtyPerHour: input.dirtyPerHour * infrastructureMultiplier,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  };
  const resolvePowerStationAction = (input) => {
    const config = input.powerStationConfig;
    if (input.building.buildingTypeId !== config.buildingTypeId || input.action.actionId !== config.backupGridSwitch.actionId) {
      return null;
    }
    const metadata = cleanupPowerStationMetadata(getPowerStationMetadata(input.building), input.state.root.tick);
    metadata.backupGridSwitchExpiresAtTick = input.state.root.tick + minutesToTicks$4(config.backupGridSwitch.durationMinutes, input.tickRateMs);
    return {
      balances: {
        ...input.balances,
        cash: Math.max(0, Number(input.balances.cash || 0) - config.backupGridSwitch.cleanCashCost)
      },
      buildingMetadata: withPowerStationMetadata(input.building, metadata),
      heatGain: config.backupGridSwitch.heatGain,
      influenceChange: 0,
      inputCost: { cash: config.backupGridSwitch.cleanCashCost },
      outputGain: {},
      reportText: `Záložní síť aktivní ${config.backupGridSwitch.durationMinutes} minut. Infrastructure +${config.backupGridSwitch.temporaryInfrastructureBonusPct} %, kamery +${config.backupGridSwitch.cameraStrengthBonusPct} %, alarm +${config.backupGridSwitch.alarmStrengthBonusPct} %.`,
      powerStationResult: {
        type: "infrastructure_defense_boost",
        activeUntilTick: metadata.backupGridSwitchExpiresAtTick,
        temporaryInfrastructureBonusPct: config.backupGridSwitch.temporaryInfrastructureBonusPct,
        cameraStrengthBonusPct: config.backupGridSwitch.cameraStrengthBonusPct,
        alarmStrengthBonusPct: config.backupGridSwitch.alarmStrengthBonusPct,
        factoryProductionSpeedBonusPct: config.backupGridSwitch.factoryProductionSpeedBonusPct,
        armoryProductionSpeedBonusPct: config.backupGridSwitch.armoryProductionSpeedBonusPct
      }
    };
  };
  const validatePowerStationAction = (input) => {
    const config = input.powerStationConfig;
    if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.actionId !== config.backupGridSwitch.actionId) {
      return null;
    }
    if ((getPowerStationMetadata(input.building).backupGridSwitchExpiresAtTick ?? 0) > input.state.root.tick) {
      return "power_station_backup_grid_active";
    }
    return null;
  };
  const resolveBackupDirectBonusPct = (config, target) => {
    if (target === "factoryProductionSpeed") return config.backupGridSwitch.factoryProductionSpeedBonusPct;
    if (target === "armoryProductionSpeed") return config.backupGridSwitch.armoryProductionSpeedBonusPct;
    return 0;
  };
  const cleanupPowerStationMetadata = (metadata, tick) => ({
    backupGridSwitchExpiresAtTick: (metadata.backupGridSwitchExpiresAtTick ?? 0) > tick ? metadata.backupGridSwitchExpiresAtTick : void 0
  });
  const withPowerStationMetadata = (building2, powerStation) => ({
    ...building2.metadata ?? {},
    powerStation
  });
  const minutesToTicks$4 = (minutes, tickRateMs) => Math.max(1, Math.ceil(Math.max(0, Number(minutes || 0)) * 60 * 1e3 / Math.max(1, tickRateMs)));
  const asOptionalTick$5 = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : void 0;
  };
  const isRecord$7 = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const getOwnedWarehouseCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolveWarehouseNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      incomeMultiplier: Math.min(
        config.network.maxIncomeMultiplier,
        1 + extra * config.network.incomeBonusPctPerExtraWarehouse / 100
      ),
      storageCapacityMultiplier: Math.min(
        config.network.maxStorageCapacityMultiplier,
        1 + extra * config.network.storageCapacityBonusPctPerExtraWarehouse / 100
      ),
      heatMultiplier: Math.min(
        config.network.maxHeatMultiplier,
        1 + extra * config.network.heatBonusPctPerExtraWarehouse / 100
      )
    };
  };
  const resolveWarehouseStorageCapacity = (state, playerId, config, powerStationConfig) => {
    const ownedWarehouses = Object.values(state.buildingsById).filter(
      (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
    );
    const multiplier = resolveWarehouseNetworkMultipliers(ownedWarehouses.length, config).storageCapacityMultiplier;
    const infrastructureMultiplier = resolvePowerStationInfrastructureMultiplier({
      state,
      playerId,
      config: powerStationConfig,
      tick: state.root.tick,
      target: "warehouseStorageCapacity"
    });
    const upgradeMultiplierTotal = ownedWarehouses.reduce(
      (total, building2) => total + (1 + getWarehouseUpgrade(config, building2.level).storageBonusPct / 100),
      0
    );
    const scale = (amount) => Math.floor(Math.max(0, amount) * upgradeMultiplierTotal * multiplier * infrastructureMultiplier);
    return {
      genericResources: scale(config.storageCapacities.genericResources),
      chemicals: scale(config.storageCapacities.chemicals),
      biomass: scale(config.storageCapacities.biomass),
      metalParts: scale(config.storageCapacities.metalParts),
      techCore: scale(config.storageCapacities.techCore),
      combatModule: scale(config.storageCapacities.combatModule),
      drugsAndBoosts: scale(config.storageCapacities.drugsAndBoosts),
      weaponsAndDefense: scale(config.storageCapacities.weaponsAndDefense),
      storageCapacityBonus: scale(config.storageCapacityBonus)
    };
  };
  const applyWarehouseIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return {
        cleanPerHour: input.cleanPerHour,
        dirtyPerHour: input.dirtyPerHour,
        heatPerDay: input.heatPerDay,
        influencePerDay: input.influencePerDay,
        maxLevel: 4
      };
    }
    const count = getOwnedWarehouseCount(input.state, input.building.ownerPlayerId, input.config);
    const network = resolveWarehouseNetworkMultipliers(count, input.config);
    const upgrade = getWarehouseUpgrade(input.config, input.building.level);
    return {
      cleanPerHour: input.cleanPerHour * network.incomeMultiplier * (1 + upgrade.incomeBonusPct / 100),
      dirtyPerHour: 0,
      heatPerDay: input.heatPerDay * network.heatMultiplier * (1 - upgrade.heatReductionPct / 100),
      influencePerDay: 0,
      maxLevel: 4
    };
  };
  const getWarehouseUpgrade = (config, level) => {
    var _a;
    const safeLevel = Math.max(1, Math.min(4, Math.floor(Number(level || 1))));
    const upgrade = (_a = config.upgrades) == null ? void 0 : _a[safeLevel];
    return {
      incomeBonusPct: Math.max(0, Number((upgrade == null ? void 0 : upgrade.incomeBonusPct) || 0)),
      storageBonusPct: Math.max(0, Number((upgrade == null ? void 0 : upgrade.storageBonusPct) || 0)),
      heatReductionPct: Math.max(0, Number((upgrade == null ? void 0 : upgrade.heatReductionPct) || 0))
    };
  };
  const getWarehouseCapacityForResource = (capacity, resourceKey) => {
    switch (resourceKey) {
      case "chemicals":
        return capacity.chemicals;
      case "biomass":
        return capacity.biomass;
      case "metal-parts":
        return capacity.metalParts;
      case "tech-core":
        return capacity.techCore;
      case "combat-module":
      case "combatModule":
        return capacity.combatModule;
      case "stim-pack":
      case "neon-dust":
      case "pulse-shot":
      case "velvet-smoke":
      case "ghost-serum":
      case "overdrive-x":
        return capacity.drugsAndBoosts;
      case "pistol":
      case "smg":
      case "grenade":
      case "vest":
      case "barricades":
      case "cameras":
      case "defense-tower":
      case "alarm":
        return capacity.weaponsAndDefense;
      default:
        return capacity.genericResources || capacity.storageCapacityBonus;
    }
  };
  const CLINIC_RECOVERABLE_ITEMS = /* @__PURE__ */ new Set([
    "population",
    "gang-members"
  ]);
  const RARE_ITEMS = /* @__PURE__ */ new Set();
  const getOwnedClinicCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolveClinicRecoveryRatePct = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return Math.min(config.recovery.maxRecoveryRatePct, config.recovery.baseRecoveryRatePct + extra * config.recovery.recoveryRatePctPerExtraClinic);
  };
  const resolveClinicRecoveryRatePctForPlayer = (state, playerId, config, powerStationConfig) => {
    const baseRate = resolveClinicRecoveryRatePct(getOwnedClinicCount(state, playerId, config), config);
    const infrastructureMultiplier = resolvePowerStationInfrastructureMultiplier({
      state,
      playerId,
      config: powerStationConfig,
      tick: state.root.tick,
      target: "clinicRecoveryRate"
    });
    return Math.min(config.recovery.maxRecoveryRatePct, baseRate * infrastructureMultiplier);
  };
  const resolveClinicNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraClinic / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraClinic / 100)
    };
  };
  const applyClinicIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return { cleanPerHour: input.cleanPerHour, dirtyPerHour: input.dirtyPerHour, heatPerDay: input.heatPerDay, influencePerDay: input.influencePerDay, maxLevel: 1 };
    }
    const network = resolveClinicNetworkMultipliers(getOwnedClinicCount(input.state, input.building.ownerPlayerId, input.config), input.config);
    return {
      cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
      dirtyPerHour: 0,
      heatPerDay: input.heatPerDay * network.heatMultiplier,
      influencePerDay: 0,
      maxLevel: 1
    };
  };
  const appendRecoveryPoolEntries = (state, playerId, entries, sourceId = "loss") => {
    if (!playerId || entries.length <= 0) return state;
    const player = state.playersById[playerId];
    if (!player) return state;
    const safeEntries = entries.filter((entry) => Math.floor(Number(entry.amount || 0)) > 0 && entry.itemType).map((entry, index) => ({
      ...entry,
      amount: Math.floor(Number(entry.amount || 0)),
      id: `recovery:${state.root.tick}:${sourceId}:${index}:${entry.itemType}`,
      lostAtTick: state.root.tick,
      lostAt: (/* @__PURE__ */ new Date(0)).toISOString()
    }));
    if (safeEntries.length <= 0) return state;
    return {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: {
          ...player,
          recoveryPool: [...player.recoveryPool ?? [], ...safeEntries],
          version: player.version + 1
        }
      }
    };
  };
  const createRecoveryEntriesFromLosses = (losses, source) => Object.entries(losses ?? {}).flatMap(
    ([itemType, amount]) => isClinicRecoverableItem(itemType) ? [{
      itemType,
      amount: Math.floor(Number(amount || 0)),
      source
    }] : []
  );
  const resolveClinicAction = (input) => {
    if (input.actionId !== input.clinicConfig.stabilizationProtocol.actionId) return null;
    const player = input.state.playersById[input.playerId];
    if (!player) return null;
    const nowTick = input.state.root.tick;
    const ttlTicks = Math.ceil(input.clinicConfig.recovery.poolTtlMinutes * 6e4 / Math.max(1, input.tickRateMs));
    const ttlMs = input.clinicConfig.recovery.poolTtlMinutes * 6e4;
    const pool = player.recoveryPool ?? [];
    const fresh = pool.filter((entry) => isRecoveryEntryFresh(entry, nowTick, ttlTicks, ttlMs));
    const expired = pool.filter((entry) => !fresh.includes(entry));
    const recoverableFresh = fresh.filter((entry) => isClinicRecoverableItem(entry.itemType));
    const recyclingFresh = fresh.filter((entry) => !isClinicRecoverableItem(entry.itemType));
    const baseRate = resolveClinicRecoveryRatePctForPlayer(input.state, input.playerId, input.clinicConfig, input.powerStationConfig) / 100;
    const nextBalances = {
      ...input.balances,
      cash: Math.max(0, Number(input.balances.cash || 0) - input.clinicConfig.stabilizationProtocol.cleanCashCost)
    };
    const random = input.random ?? Math.random;
    const recovered = {};
    const lostByCapacity = {};
    const capacity = input.warehouseConfig ? resolveWarehouseStorageCapacity(input.state, input.playerId, input.warehouseConfig, input.powerStationConfig) : null;
    for (const entry of recoverableFresh) {
      const rate = entry.source === "trap" || entry.source === "toxic_trap" ? baseRate * input.clinicConfig.recovery.toxicTrapRateMultiplier : baseRate;
      const raw = Math.max(0, Number(entry.amount || 0)) * rate;
      let amount = Math.floor(raw);
      if (RARE_ITEMS.has(entry.itemType) && random() < raw - amount) amount += 1;
      if (amount <= 0) continue;
      if (entry.itemType === "population" || entry.itemType === "gang-members") {
        nextBalances["gang-members"] = Math.max(0, Number(nextBalances["gang-members"] || 0) + amount);
        recovered.population = Math.max(0, Number(recovered.population || 0) + amount);
        recovered["gang-members"] = Math.max(0, Number(recovered["gang-members"] || 0) + amount);
        continue;
      }
      const cap = capacity ? getWarehouseCapacityForResource(capacity, entry.itemType) : Number.POSITIVE_INFINITY;
      const current = Math.max(0, Number(nextBalances[entry.itemType] || 0));
      const accepted = Number.isFinite(cap) ? Math.max(0, Math.min(amount, cap - current)) : amount;
      const overflow = Math.max(0, amount - accepted);
      if (accepted > 0) {
        nextBalances[entry.itemType] = current + accepted;
        recovered[entry.itemType] = Math.max(0, Number(recovered[entry.itemType] || 0) + accepted);
      }
      if (overflow > 0) lostByCapacity[entry.itemType] = Math.max(0, Number(lostByCapacity[entry.itemType] || 0) + overflow);
    }
    return {
      balances: nextBalances,
      playerRecoveryPool: recyclingFresh,
      heatGain: input.clinicConfig.stabilizationProtocol.heatGain,
      influenceChange: 0,
      inputCost: { cash: input.clinicConfig.stabilizationProtocol.cleanCashCost },
      outputGain: recovered,
      reportText: "Stabilizační protokol obnovil část nedávných ztrát.",
      clinicResult: {
        type: "recovery",
        recoveryRatePct: Math.round(baseRate * 100),
        recovered,
        lostByCapacity,
        keptForRecycling: recyclingFresh.reduce((total, entry) => total + Math.max(0, Number(entry.amount || 0)), 0),
        expiredCount: expired.reduce((total, entry) => total + Math.max(0, Number(entry.amount || 0)), 0),
        cleanCashCost: input.clinicConfig.stabilizationProtocol.cleanCashCost,
        heatGain: input.clinicConfig.stabilizationProtocol.heatGain
      }
    };
  };
  const validateClinicAction = (input) => {
    const config = input.clinicConfig;
    if (!config || input.actionId !== config.stabilizationProtocol.actionId) return null;
    if (Math.max(0, Number(input.balances.cash || 0)) < config.stabilizationProtocol.cleanCashCost) return "clinic_insufficient_clean_cash";
    const player = input.state.playersById[input.playerId];
    const ttlTicks = Math.ceil(config.recovery.poolTtlMinutes * 6e4 / Math.max(1, input.tickRateMs));
    const ttlMs = config.recovery.poolTtlMinutes * 6e4;
    const hasFresh = ((player == null ? void 0 : player.recoveryPool) ?? []).some(
      (entry) => isRecoveryEntryFresh(entry, input.state.root.tick, ttlTicks, ttlMs) && isClinicRecoverableItem(entry.itemType) && Number(entry.amount || 0) > 0
    );
    return hasFresh ? null : "clinic_recovery_pool_empty";
  };
  const isClinicRecoverableItem = (itemType) => CLINIC_RECOVERABLE_ITEMS.has(String(itemType || ""));
  const isRecoveryEntryFresh = (entry, nowTick, ttlTicks, ttlMs) => {
    const lostAtTick = Number(entry.lostAtTick);
    if (Number.isFinite(lostAtTick)) {
      return nowTick - Math.max(0, lostAtTick) <= ttlTicks;
    }
    const lostAtMs = entry.lostAt ? Date.parse(entry.lostAt) : Number.NaN;
    return Number.isFinite(lostAtMs) ? Date.now() - lostAtMs <= ttlMs : true;
  };
  const getOwnedConvenienceStoreCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolveConvenienceStoreNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      cleanIncomeMultiplier: Math.min(config.network.maxCleanIncomeMultiplier, 1 + extra * config.network.cleanIncomeBonusPctPerExtraStore / 100),
      dirtyIncomeMultiplier: Math.min(config.network.maxDirtyIncomeMultiplier, 1 + extra * config.network.dirtyIncomeBonusPctPerExtraStore / 100),
      influenceMultiplier: Math.min(config.network.maxInfluenceMultiplier, 1 + extra * config.network.influenceBonusPctPerExtraStore / 100),
      rumorMultiplier: Math.min(config.network.maxRumorMultiplier, 1 + extra * config.network.rumorChanceBonusPctPerExtraStore / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraStore / 100)
    };
  };
  const resolveConvenienceStoreRumorStats = (input) => {
    const storeCount = getOwnedConvenienceStoreCount(input.state, input.playerId, input.config);
    const restaurantCount = input.restaurantConfig ? getOwnedActiveBuildingCount(input.state, input.playerId, input.restaurantConfig.buildingTypeId) : 0;
    const network = resolveConvenienceStoreNetworkMultipliers(storeCount, input.config);
    const civilRumorChanceBonusPct = resolveCivilRumorChanceBonusPct(storeCount, restaurantCount, input.config);
    const civilTruthBonusPct = storeCount >= input.config.restaurantSynergy.truthStoreThreshold && restaurantCount >= input.config.restaurantSynergy.truthRestaurantThreshold ? input.config.restaurantSynergy.civilRumorTruthBonusPct : 0;
    return {
      storeCount,
      restaurantCount,
      network,
      civilRumorChanceBonusPct,
      passiveRumorChancePct: Math.min(100, input.config.baseRumorChancePct * network.rumorMultiplier + civilRumorChanceBonusPct),
      truthChancePct: Math.min(
        100,
        resolveTruthChancePct$1(storeCount, input.config) + civilTruthBonusPct
      ),
      districtHintChancePct: input.config.districtHintChancePct,
      areaHintChancePct: input.config.areaHintChancePct,
      buildingHintChancePct: input.config.buildingHintChancePct,
      reliabilityVisible: false
    };
  };
  const applyConvenienceStoreIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return {
        cleanPerHour: input.cleanPerHour,
        dirtyPerHour: input.dirtyPerHour,
        heatPerDay: input.heatPerDay,
        influencePerDay: input.influencePerDay,
        maxLevel: 1
      };
    }
    const network = resolveConvenienceStoreNetworkMultipliers(getOwnedConvenienceStoreCount(input.state, input.building.ownerPlayerId, input.config), input.config);
    return {
      cleanPerHour: input.cleanPerHour * network.cleanIncomeMultiplier,
      dirtyPerHour: input.dirtyPerHour * network.dirtyIncomeMultiplier,
      heatPerDay: input.heatPerDay * network.heatMultiplier,
      influencePerDay: input.influencePerDay * network.influenceMultiplier,
      maxLevel: 1
    };
  };
  const applyConvenienceStorePassiveRumors = (state, config, tickRateMs, restaurantConfig) => {
    const intervalTicks = minutesToTicks$3(config.passiveRumorIntervalMinutes, tickRateMs);
    let buildingsById = state.buildingsById;
    let changed = false;
    for (const building2 of Object.values(state.buildingsById)) {
      if (building2.buildingTypeId !== config.buildingTypeId || building2.status !== "active" || !building2.ownerPlayerId) {
        continue;
      }
      const metadata = cleanupMetadata(getConvenienceStoreMetadata(building2));
      if (metadata.lastPassiveRumorCheckTick === void 0) {
        metadata.lastPassiveRumorCheckTick = state.root.tick;
        buildingsById = updateBuildingMetadata$1(buildingsById, building2, metadata);
        changed = true;
        continue;
      }
      if ((metadata.lastPassiveRumorCheckTick ?? -Infinity) + intervalTicks > state.root.tick) {
        continue;
      }
      const stats = resolveConvenienceStoreRumorStats({ state, playerId: building2.ownerPlayerId, config, restaurantConfig });
      metadata.lastPassiveRumorCheckTick = state.root.tick;
      if (deterministicRollPct$3(`${building2.id}:convenience-store-passive-rumor:${state.root.tick}`) < stats.passiveRumorChancePct) {
        metadata.rumorEvents.push(generateRumor({
          state,
          playerId: building2.ownerPlayerId,
          config,
          restaurantConfig,
          seed: `${building2.id}:convenience-store-rumor-event:${state.root.tick}`
        }));
      }
      buildingsById = updateBuildingMetadata$1(buildingsById, building2, metadata);
      changed = true;
    }
    return changed ? { ...state, buildingsById } : state;
  };
  const getConvenienceStoreMetadata = (building2) => {
    var _a;
    const raw = isRecord$6((_a = building2.metadata) == null ? void 0 : _a.convenienceStore) ? building2.metadata.convenienceStore : {};
    return {
      lastPassiveRumorCheckTick: asOptionalTick$4(raw.lastPassiveRumorCheckTick),
      rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord$6).map(normalizeRumor$2).slice(-12) : []
    };
  };
  const generateRumor = (input) => {
    const stats = resolveConvenienceStoreRumorStats(input);
    const type = input.config.rumorTypes[Math.floor(deterministicRollPct$3(`${input.seed}:type`) / 100 * input.config.rumorTypes.length)] ?? "fake";
    const isTrue = deterministicRollPct$3(`${input.seed}:truth`) < stats.truthChancePct;
    const districtHint = deterministicRollPct$3(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint$2(input.state, input.seed) : null;
    const areaHint = deterministicRollPct$3(`${input.seed}:area`) < stats.areaHintChancePct ? pickAreaHint(input.state, input.seed) : null;
    const buildingHint = deterministicRollPct$3(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint$2(input.state, input.seed) : null;
    const reliabilityLabel = stats.reliabilityVisible ? formatReliability$1(stats.truthChancePct) : null;
    return {
      type,
      truthChancePct: stats.truthChancePct,
      isTrue,
      districtHint,
      areaHint,
      buildingHint,
      reliabilityVisible: stats.reliabilityVisible,
      reliabilityLabel,
      text: formatRumorText$2(isTrue ? type : "fake", districtHint, areaHint, buildingHint, reliabilityLabel)
    };
  };
  const formatRumorText$2 = (type, districtHint, areaHint, buildingHint, reliabilityLabel) => {
    const place = districtHint ? ` k ${districtHint}` : areaHint ? ` v ${areaHint}` : buildingHint ? ` u budovy typu ${buildingHint}` : "";
    const reliability = reliabilityLabel ? ` Spolehlivost: ${reliabilityLabel}.` : "";
    return `${formatRumorSubject$1(type)}${place}.${reliability}`;
  };
  const formatRumorSubject$1 = (type) => {
    switch (type) {
      case "night_movement":
        return "Prodavač viděl skupinu lidí mířit";
      case "suspicious_purchase":
        return "Někdo koupil baterky, rukavice a pásku. Neptal se na cenu";
      case "courier_trace":
        return "Dodávka bez značek zastavila za obchodem";
      case "small_conflict":
        return "Před večerkou se řešil krátký konflikt";
      case "police_patrol":
        return "Hlídka se dnes večer motala kolem stejného bloku";
      case "robbery_preparation":
        return "Zákazník mluvil o přípravě rychlé vykrádačky";
      case "possible_trap":
        return "Někdo se chlubil, že jeden blok čeká na nezvané hosty";
      case "weak_defense":
        return "U regálu padla řeč o slabé obraně";
      case "dirty_cash_movement":
        return "V zadní místnosti se počítaly bankovky mimo kasu";
      default:
        return "U pultu kolovala neověřená pouliční historka";
    }
  };
  const resolveCivilRumorChanceBonusPct = (storeCount, restaurantCount, config) => {
    if (storeCount >= config.restaurantSynergy.secondStoreThreshold && restaurantCount >= config.restaurantSynergy.secondRestaurantThreshold) {
      return config.restaurantSynergy.secondCivilRumorChanceBonusPct;
    }
    if (storeCount >= config.restaurantSynergy.firstStoreThreshold && restaurantCount >= config.restaurantSynergy.firstRestaurantThreshold) {
      return config.restaurantSynergy.firstCivilRumorChanceBonusPct;
    }
    return 0;
  };
  const resolveTruthChancePct$1 = (count, config) => {
    const safeCount = Math.max(0, Math.floor(Number(count || 0)));
    const tier = config.truthChanceByOwnedCount.find(
      (candidate) => safeCount >= candidate.minOwned && (candidate.maxOwned === null || safeCount <= candidate.maxOwned)
    );
    return (tier == null ? void 0 : tier.truthChancePct) ?? 0;
  };
  const updateBuildingMetadata$1 = (buildingsById, building2, metadata) => ({
    ...buildingsById,
    [building2.id]: {
      ...building2,
      metadata: {
        ...building2.metadata ?? {},
        convenienceStore: cleanupMetadata(metadata)
      },
      version: building2.version + 1
    }
  });
  const cleanupMetadata = (metadata) => ({
    ...metadata,
    rumorEvents: metadata.rumorEvents.slice(-12)
  });
  const pickDistrictHint$2 = (state, seed) => {
    var _a;
    const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
    return districts.length > 0 ? ((_a = districts[Math.floor(deterministicRollPct$3(`${seed}:district-index`) / 100 * districts.length)]) == null ? void 0 : _a.name) ?? null : null;
  };
  const pickAreaHint = (state, seed) => {
    const districts = Object.values(state.districtsById).filter((district2) => district2.status !== "destroyed");
    const district = districts.length > 0 ? districts[Math.floor(deterministicRollPct$3(`${seed}:area-index`) / 100 * districts.length)] : null;
    return (district == null ? void 0 : district.zone) ? `${district.zone} zóně` : null;
  };
  const pickBuildingHint$2 = (state, seed) => {
    var _a;
    const buildings = Object.values(state.buildingsById).filter((building2) => building2.status === "active");
    return buildings.length > 0 ? ((_a = buildings[Math.floor(deterministicRollPct$3(`${seed}:building-index`) / 100 * buildings.length)]) == null ? void 0 : _a.buildingTypeId) ?? null : null;
  };
  const formatReliability$1 = (truthChancePct) => truthChancePct >= 60 ? "střední" : truthChancePct >= 50 ? "nízká až střední" : "nízká";
  const normalizeRumor$2 = (value) => ({
    type: String(value.type || "fake"),
    truthChancePct: Math.max(0, Number(value.truthChancePct || 0)),
    isTrue: Boolean(value.isTrue),
    districtHint: value.districtHint ? String(value.districtHint) : null,
    areaHint: value.areaHint ? String(value.areaHint) : null,
    buildingHint: value.buildingHint ? String(value.buildingHint) : null,
    reliabilityVisible: Boolean(value.reliabilityVisible),
    reliabilityLabel: value.reliabilityLabel ? String(value.reliabilityLabel) : null,
    text: String(value.text || "")
  });
  const minutesToTicks$3 = (minutes, tickRateMs) => Math.max(1, Math.ceil(Math.max(0, Number(minutes || 0)) * 60 * 1e3 / Math.max(1, tickRateMs)));
  const deterministicRollPct$3 = (seed) => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 1e4 / 100;
  };
  const asOptionalTick$4 = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : void 0;
  };
  const isRecord$6 = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const getOwnedActiveBuildingCount = (state, playerId, buildingTypeId) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const getOwnedExchangeOfficeCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolveExchangeOfficeNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraExchange / 100),
      launderingLimitMultiplier: Math.min(config.network.maxLaunderingLimitMultiplier, 1 + extra * config.network.launderingLimitBonusPctPerExtraExchange / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraExchange / 100)
    };
  };
  const getExchangeOfficeMetadata = (building2) => {
    var _a, _b;
    const raw = isRecord$5((_a = building2.metadata) == null ? void 0 : _a.exchangeOffice) ? (_b = building2.metadata) == null ? void 0 : _b.exchangeOffice : {};
    return {
      launderedEvents: Array.isArray(raw.launderedEvents) ? raw.launderedEvents.map((entry) => ({
        tick: Math.max(0, Math.floor(Number((entry == null ? void 0 : entry.tick) || 0))),
        amount: Math.max(0, Math.floor(Number((entry == null ? void 0 : entry.amount) || 0)))
      })).filter((entry) => entry.amount > 0) : [],
      auditRiskBonuses: Array.isArray(raw.auditRiskBonuses) ? raw.auditRiskBonuses.map((entry) => ({
        expiresAtTick: Math.max(0, Math.floor(Number((entry == null ? void 0 : entry.expiresAtTick) || 0))),
        riskPct: Math.max(0, Number((entry == null ? void 0 : entry.riskPct) || 0)),
        source: String((entry == null ? void 0 : entry.source) || "exchange_office")
      })).filter((entry) => entry.expiresAtTick > 0 && entry.riskPct > 0) : [],
      incomePenaltyExpiresAtTick: asOptionalTick$3(raw.incomePenaltyExpiresAtTick),
      incomePenaltyPct: asOptionalNumber$1(raw.incomePenaltyPct),
      dirtyIncomePenaltyExpiresAtTick: asOptionalTick$3(raw.dirtyIncomePenaltyExpiresAtTick),
      dirtyIncomePenaltyPct: asOptionalNumber$1(raw.dirtyIncomePenaltyPct),
      actionBlockedUntilTick: asOptionalTick$3(raw.actionBlockedUntilTick),
      lastAuditCheckTick: asOptionalTick$3(raw.lastAuditCheckTick),
      auditLog: Array.isArray(raw.auditLog) ? raw.auditLog.filter(isRecord$5).slice(-10) : []
    };
  };
  const resolveExchangeOfficeAuditRisk = (input) => {
    const windowTicks = minutesToTicks$2(input.config.auditWindowMinutes, input.tickRateMs);
    const thresholdTick = Math.max(0, input.tick - windowTicks);
    const ownedBuildings = getOwnedExchangeOfficeBuildings(input.state, input.ownerPlayerId, input.config);
    const launderedInWindow = ownedBuildings.flatMap((building2) => getExchangeOfficeMetadata(building2).launderedEvents).filter((entry) => entry.tick >= thresholdTick).reduce((total, entry) => total + entry.amount, 0);
    const tier = input.config.auditRiskTiers.find(
      (candidate) => candidate.maxLaunderedAmount === null || launderedInWindow <= candidate.maxLaunderedAmount
    );
    let riskPct = (tier == null ? void 0 : tier.riskPct) ?? input.config.baseAuditRiskPct;
    riskPct += ownedBuildings.flatMap((building2) => getExchangeOfficeMetadata(building2).auditRiskBonuses).filter((bonus) => bonus.expiresAtTick > input.tick).reduce((total, bonus) => total + bonus.riskPct, 0);
    if (ownedBuildings.length >= 8) {
      riskPct += 9;
    } else if (ownedBuildings.length >= 5) {
      riskPct += 5;
    }
    if (input.playerHeat > 180) {
      riskPct += 15;
    } else if (input.playerHeat > 100) {
      riskPct += 8;
    }
    return {
      riskPct: Math.max(0, Math.round(riskPct * 10) / 10),
      launderedInWindow,
      ownedCount: ownedBuildings.length
    };
  };
  const applyExchangeOfficeIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return {
        cleanPerHour: input.cleanPerHour,
        dirtyPerHour: input.dirtyPerHour,
        heatPerDay: input.heatPerDay,
        influencePerDay: input.influencePerDay
      };
    }
    const metadata = getExchangeOfficeMetadata(input.building);
    const network = resolveExchangeOfficeNetworkMultipliers(
      getOwnedExchangeOfficeCount(input.state, input.building.ownerPlayerId, input.config),
      input.config
    );
    const incomePenalty = (metadata.incomePenaltyExpiresAtTick ?? 0) > input.tick ? 1 - Math.max(0, Number(metadata.incomePenaltyPct || 0)) / 100 : 1;
    const dirtyPenalty = (metadata.dirtyIncomePenaltyExpiresAtTick ?? 0) > input.tick ? 1 - Math.max(0, Number(metadata.dirtyIncomePenaltyPct || 0)) / 100 : 1;
    return {
      cleanPerHour: input.cleanPerHour * network.incomeMultiplier * incomePenalty,
      dirtyPerHour: input.dirtyPerHour * network.incomeMultiplier * incomePenalty * dirtyPenalty,
      heatPerDay: input.heatPerDay * network.heatMultiplier,
      influencePerDay: input.influencePerDay
    };
  };
  const resolveExchangeOfficeAction = (input) => {
    if (input.action.actionId !== input.exchangeConfig.goodRate.actionId) {
      return null;
    }
    const metadata = cleanupExchangeOfficeMetadata(getExchangeOfficeMetadata(input.building), input.state.root.tick);
    const dirtyCash = Math.max(0, Math.floor(Number(input.balances["dirty-cash"] || 0)));
    const ownedCount = input.building.ownerPlayerId ? getOwnedExchangeOfficeCount(input.state, input.building.ownerPlayerId, input.exchangeConfig) : 1;
    const network = resolveExchangeOfficeNetworkMultipliers(ownedCount, input.exchangeConfig);
    const capacity = Math.floor(input.exchangeConfig.goodRate.maxDirtyCashPerAction * network.launderingLimitMultiplier);
    const amount = Math.min(
      Math.floor(dirtyCash * input.exchangeConfig.goodRate.dirtyCashSharePct / 100),
      capacity
    );
    const fee = Math.floor(amount * input.exchangeConfig.goodRate.feePct / 100);
    const cleanGain = Math.max(0, amount - fee);
    const heatGain = input.exchangeConfig.goodRate.heatGain;
    const nextBalances = {
      ...input.balances,
      "dirty-cash": Math.max(0, dirtyCash - amount),
      cash: Math.max(0, Number(input.balances.cash || 0) + cleanGain)
    };
    metadata.launderedEvents.push({ tick: input.state.root.tick, amount });
    metadata.auditRiskBonuses.push({
      expiresAtTick: input.state.root.tick + minutesToTicks$2(input.exchangeConfig.goodRate.auditRiskDurationMinutes, input.tickRateMs),
      riskPct: input.exchangeConfig.goodRate.auditRiskBonusPct,
      source: input.exchangeConfig.goodRate.actionId
    });
    return {
      balances: nextBalances,
      buildingMetadata: withExchangeOfficeMetadata(input.building, metadata),
      heatGain,
      influenceChange: input.exchangeConfig.goodRate.influenceGain,
      inputCost: { "dirty-cash": amount },
      outputGain: { cash: cleanGain },
      reportText: `Výhodný kurz vypral ${amount} dirty cash na ${cleanGain} clean cash. Poplatek ${fee}. Heat +${heatGain}.`,
      exchangeResult: {
        type: "laundering",
        launderedDirtyCash: amount,
        cleanCashGained: cleanGain,
        feePaid: fee,
        heatGain,
        influenceGain: input.exchangeConfig.goodRate.influenceGain,
        ownedExchangeOffices: ownedCount,
        networkMultiplier: network
      }
    };
  };
  const validateExchangeOfficeAction = (input) => {
    const config = input.exchangeConfig;
    if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.actionId !== config.goodRate.actionId) {
      return null;
    }
    const metadata = getExchangeOfficeMetadata(input.building);
    if ((metadata.actionBlockedUntilTick ?? 0) > input.state.root.tick) {
      return "exchange_office_action_blocked";
    }
    if (Math.max(0, Number(input.balances["dirty-cash"] || 0)) < config.goodRate.minimumDirtyCash) {
      return "exchange_office_insufficient_dirty_cash";
    }
    return null;
  };
  const applyExchangeOfficeAuditChecks = (state, config, tickRateMs) => {
    var _a;
    const checkEveryTicks = minutesToTicks$2(config.auditCheckEveryMinutes, tickRateMs);
    let nextState = state;
    let buildingsById = state.buildingsById;
    let districtsById = state.districtsById;
    let resourceStatesById = state.resourceStatesById;
    let policeStatesById = state.policeStatesById;
    let changed = false;
    for (const building2 of Object.values(state.buildingsById)) {
      if (building2.buildingTypeId !== config.buildingTypeId || building2.status !== "active" || !building2.ownerPlayerId) {
        continue;
      }
      const metadata = cleanupExchangeOfficeMetadata(getExchangeOfficeMetadata(building2), state.root.tick);
      if ((metadata.lastAuditCheckTick ?? -Infinity) + checkEveryTicks > state.root.tick) {
        continue;
      }
      if (metadata.lastAuditCheckTick === void 0) {
        metadata.lastAuditCheckTick = state.root.tick;
        buildingsById = {
          ...buildingsById,
          [building2.id]: {
            ...building2,
            metadata: withExchangeOfficeMetadata(building2, metadata),
            version: building2.version + 1
          }
        };
        changed = true;
        continue;
      }
      const player = state.playersById[building2.ownerPlayerId];
      const district = state.districtsById[building2.districtId];
      if (!player || !district) {
        continue;
      }
      const playerHeat = Math.max(0, Number(((_a = policeStatesById[player.policeStateId]) == null ? void 0 : _a.heat) ?? district.heat ?? 0));
      const risk = resolveExchangeOfficeAuditRisk({
        config,
        state: { ...nextState, buildingsById },
        ownerPlayerId: player.id,
        playerHeat,
        tick: state.root.tick,
        tickRateMs
      });
      const triggered = deterministicRollPct$2(`${building2.id}:exchange-audit:${state.root.tick}`) < risk.riskPct;
      metadata.lastAuditCheckTick = state.root.tick;
      if (triggered) {
        const consequence = resolveAuditConsequence(building2.id, state.root.tick);
        metadata.auditLog = [
          ...metadata.auditLog || [],
          { tick: state.root.tick, consequence, riskPct: risk.riskPct, launderedInWindow: risk.launderedInWindow }
        ].slice(-10);
        const ownedBuildings = getOwnedExchangeOfficeBuildings({ ...nextState, buildingsById }, player.id, config);
        if (consequence === "suspiciousTransaction") {
          buildingsById = applyMetadataToOwnedExchanges(buildingsById, ownedBuildings, (entry) => ({
            ...entry,
            incomePenaltyPct: config.auditConsequences.suspiciousTransaction.incomePenaltyPct,
            incomePenaltyExpiresAtTick: state.root.tick + minutesToTicks$2(config.auditConsequences.suspiciousTransaction.durationMinutes, tickRateMs)
          }));
        } else if (consequence === "blockedTransfer") {
          buildingsById = applyMetadataToOwnedExchanges(buildingsById, ownedBuildings, (entry) => ({
            ...entry,
            actionBlockedUntilTick: state.root.tick + minutesToTicks$2(config.auditConsequences.blockedTransfer.actionBlockedMinutes, tickRateMs)
          }));
        } else if (consequence === "lostClient") {
          buildingsById = applyMetadataToOwnedExchanges(buildingsById, ownedBuildings, (entry) => ({
            ...entry,
            dirtyIncomePenaltyPct: config.auditConsequences.lostClient.dirtyIncomePenaltyPct,
            dirtyIncomePenaltyExpiresAtTick: state.root.tick + minutesToTicks$2(config.auditConsequences.lostClient.durationMinutes, tickRateMs)
          }));
        } else if (consequence === "documentCheck") {
          districtsById = {
            ...districtsById,
            [district.id]: {
              ...district,
              heat: Math.max(0, Number(district.heat || 0) + config.auditConsequences.documentCheck.heatGain),
              version: district.version + 1
            }
          };
          const policeState = policeStatesById[player.policeStateId] ?? createPlayerPoliceState(player, state.root.tick);
          const heat = Math.max(0, Number(policeState.heat || 0) + config.auditConsequences.documentCheck.heatGain);
          policeStatesById = {
            ...policeStatesById,
            [policeState.id]: {
              ...policeState,
              heat,
              wantedLevel: resolveWantedLevel(heat),
              version: policeState.version + (policeStatesById[policeState.id] ? 1 : 0)
            }
          };
        } else if (consequence === "seizedCash") {
          const current = resourceStatesById[player.resourceStateId];
          const dirtyCash = Math.max(0, Number((current == null ? void 0 : current.balances["dirty-cash"]) || 0));
          const loss = Math.floor(dirtyCash * config.auditConsequences.seizedCash.dirtyCashLossPct / 100);
          if (current && loss > 0) {
            resourceStatesById = {
              ...resourceStatesById,
              [current.id]: {
                ...current,
                balances: {
                  ...current.balances,
                  "dirty-cash": Math.max(0, dirtyCash - loss)
                },
                version: current.version + 1
              }
            };
          }
        }
      }
      const currentMetadata = getExchangeOfficeMetadata(buildingsById[building2.id] ?? building2);
      const finalMetadata = {
        ...currentMetadata,
        launderedEvents: metadata.launderedEvents,
        auditRiskBonuses: metadata.auditRiskBonuses,
        lastAuditCheckTick: metadata.lastAuditCheckTick,
        auditLog: metadata.auditLog
      };
      buildingsById = {
        ...buildingsById,
        [building2.id]: {
          ...building2,
          metadata: withExchangeOfficeMetadata(building2, finalMetadata),
          version: building2.version + 1
        }
      };
      changed = true;
    }
    return changed ? { ...nextState, buildingsById, districtsById, resourceStatesById, policeStatesById } : state;
  };
  const getOwnedExchangeOfficeBuildings = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  );
  const applyMetadataToOwnedExchanges = (buildingsById, buildings, update) => {
    let next = buildingsById;
    for (const building2 of buildings) {
      const metadata = update(getExchangeOfficeMetadata(building2));
      next = {
        ...next,
        [building2.id]: {
          ...building2,
          metadata: withExchangeOfficeMetadata(building2, metadata),
          version: building2.version + 1
        }
      };
    }
    return next;
  };
  const resolveAuditConsequence = (buildingId, tick) => {
    const roll = Math.floor(deterministicRollPct$2(`${buildingId}:exchange-audit-consequence:${tick}`) / 20);
    return ["suspiciousTransaction", "blockedTransfer", "lostClient", "documentCheck", "seizedCash"][Math.max(0, Math.min(4, roll))];
  };
  const cleanupExchangeOfficeMetadata = (metadata, tick) => ({
    ...metadata,
    auditRiskBonuses: metadata.auditRiskBonuses.filter((bonus) => bonus.expiresAtTick > tick),
    auditLog: (metadata.auditLog || []).slice(-10)
  });
  const withExchangeOfficeMetadata = (building2, exchangeOffice) => ({
    ...building2.metadata ?? {},
    exchangeOffice
  });
  const minutesToTicks$2 = (minutes, tickRateMs) => Math.max(1, Math.ceil(Math.max(0, Number(minutes || 0)) * 60 * 1e3 / Math.max(1, tickRateMs)));
  const deterministicRollPct$2 = (seed) => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 1e4 / 100;
  };
  const asOptionalTick$3 = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : void 0;
  };
  const asOptionalNumber$1 = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : void 0;
  };
  const isRecord$5 = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const getOwnedGarageCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolveGarageNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraGarage / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraGarage / 100)
    };
  };
  const resolveGarageCooldownStats = (input) => {
    if (!input.config || !input.playerId) {
      return {
        ownedCount: 0,
        cooldownReductionPct: 0,
        fullBonusCategories: [],
        halfBonusCategories: [],
        excludedCategories: []
      };
    }
    const ownedCount = getOwnedGarageCount(input.state, input.playerId, input.config);
    return {
      ownedCount,
      cooldownReductionPct: Math.min(
        input.config.cooldownReduction.maxReductionPct,
        ownedCount * input.config.cooldownReduction.reductionPctPerGarage
      ),
      fullBonusCategories: [...input.config.cooldownReduction.fullBonusActionCategories],
      halfBonusCategories: [...input.config.cooldownReduction.halfBonusActionCategories],
      excludedCategories: [...input.config.cooldownReduction.excludedActionCategories]
    };
  };
  const resolveGarageCooldownMultiplier = (input) => {
    if (!input.config || !input.playerId) {
      return 1;
    }
    const stats = resolveGarageCooldownStats({
      state: input.state,
      playerId: input.playerId,
      config: input.config
    });
    const category = input.category;
    const reductionScale = input.config.cooldownReduction.fullBonusActionCategories.includes(category) ? 1 : input.config.cooldownReduction.halfBonusActionCategories.includes(category) ? 0.5 : 0;
    const reductionPct = Math.min(input.config.cooldownReduction.maxReductionPct, stats.cooldownReductionPct * reductionScale);
    return Math.max(1 - input.config.cooldownReduction.maxReductionPct / 100, 1 - reductionPct / 100);
  };
  const applyGarageCooldownReductionTicks = (input) => {
    const baseTicks = Math.max(0, Math.ceil(Number(input.baseTicks || 0)));
    if (baseTicks <= 0) {
      return 0;
    }
    const multiplier = resolveGarageCooldownMultiplier({
      state: input.state,
      playerId: input.playerId,
      config: input.config,
      category: input.category
    });
    return Math.max(1, Math.ceil(baseTicks * multiplier));
  };
  const resolveGarageCategoryForBuildingAction = (buildingTypeId, actionId) => {
    if (buildingTypeId === "clinic" && actionId === "stabilization_protocol") {
      return "clinicRecovery";
    }
    return null;
  };
  const applyGarageIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return {
        cleanPerHour: input.cleanPerHour,
        dirtyPerHour: input.dirtyPerHour,
        heatPerDay: input.heatPerDay,
        influencePerDay: input.influencePerDay,
        maxLevel: 1
      };
    }
    const network = resolveGarageNetworkMultipliers(getOwnedGarageCount(input.state, input.building.ownerPlayerId, input.config), input.config);
    return {
      cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
      dirtyPerHour: 0,
      heatPerDay: input.heatPerDay * network.heatMultiplier,
      influencePerDay: 0,
      maxLevel: 1
    };
  };
  const getOwnedRecruitmentCenterCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolveRecruitmentCenterNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraCenter / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraCenter / 100)
    };
  };
  const resolveRecruitmentCenterSupportBonuses = (input) => {
    if (!input.config || !input.playerId) {
      return createEmptySupportBonuses(input.config);
    }
    const count = getOwnedRecruitmentCenterCount(input.state, input.playerId, input.config);
    const populationProductionBonusPct = Math.min(
      input.config.populationSupport.maxPopulationProductionBonusPct,
      count * input.config.populationSupport.populationProductionBonusPctPerCenter
    );
    const apartmentCapacityBonusPct = Math.min(
      input.config.populationSupport.maxApartmentCapacityBonusPct,
      count * input.config.populationSupport.apartmentCapacityBonusPctPerCenter
    );
    const attackWeaponStrengthBonusPct = Math.min(
      input.config.combatSupport.maxAttackWeaponStrengthBonusPct,
      count * input.config.combatSupport.attackWeaponStrengthBonusPctPerCenter
    );
    const defenseItemStrengthBonusPct = Math.min(
      input.config.combatSupport.maxDefenseItemStrengthBonusPct,
      count * input.config.combatSupport.defenseItemStrengthBonusPctPerCenter
    );
    return {
      populationProductionBonusPct,
      apartmentCapacityBonusPct,
      attackWeaponStrengthBonusPct,
      defenseItemStrengthBonusPct,
      cameraStrengthBonusPct: defenseItemStrengthBonusPct,
      alarmStrengthBonusPct: defenseItemStrengthBonusPct,
      combinedCameraAlarmCapPct: input.config.combatSupport.maxCombinedCameraAlarmBonusPct
    };
  };
  const resolveCombinedCameraAlarmBonuses = (input) => {
    const recruitmentBonuses = resolveRecruitmentCenterSupportBonuses({
      state: input.state,
      playerId: input.playerId,
      config: input.recruitmentCenterConfig
    });
    const powerBonuses = resolvePowerStationDefenseBonuses({
      state: input.state,
      playerId: input.playerId,
      config: input.powerStationConfig,
      tick: input.tick
    });
    const cap = recruitmentBonuses.combinedCameraAlarmCapPct;
    return {
      cameraStrengthBonusPct: Math.min(cap, powerBonuses.cameraStrengthBonusPct + recruitmentBonuses.cameraStrengthBonusPct),
      alarmStrengthBonusPct: Math.min(cap, powerBonuses.alarmStrengthBonusPct + recruitmentBonuses.alarmStrengthBonusPct),
      recruitmentBonuses
    };
  };
  const applyRecruitmentCenterIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return {
        cleanPerHour: input.cleanPerHour,
        dirtyPerHour: input.dirtyPerHour,
        heatPerDay: input.heatPerDay,
        influencePerDay: input.influencePerDay,
        maxLevel: 1
      };
    }
    const network = resolveRecruitmentCenterNetworkMultipliers(getOwnedRecruitmentCenterCount(input.state, input.building.ownerPlayerId, input.config), input.config);
    return {
      cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
      dirtyPerHour: 0,
      heatPerDay: input.heatPerDay * network.heatMultiplier,
      influencePerDay: 0,
      maxLevel: 1
    };
  };
  const createEmptySupportBonuses = (config) => ({
    populationProductionBonusPct: 0,
    apartmentCapacityBonusPct: 0,
    attackWeaponStrengthBonusPct: 0,
    defenseItemStrengthBonusPct: 0,
    cameraStrengthBonusPct: 0,
    alarmStrengthBonusPct: 0,
    combinedCameraAlarmCapPct: (config == null ? void 0 : config.combatSupport.maxCombinedCameraAlarmBonusPct) ?? 50
  });
  const getOwnedRecyclingCenterCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolveRecyclingCenterNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraCenter / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraCenter / 100)
    };
  };
  const resolveRecyclingCenterSalvageRatePct = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return Math.min(config.salvage.maxRatePct, config.salvage.baseRatePct + extra * config.salvage.ratePctPerExtraCenter);
  };
  const resolveRecyclingCenterSalvageStats = (input) => {
    if (!input.config || !input.playerId) {
      return { ownedCount: 0, salvageRatePct: 0, freshPool: [], expiredPool: [] };
    }
    const player = input.state.playersById[input.playerId];
    const pool = (player == null ? void 0 : player.salvagePool) ?? [];
    const ttlTicks = Math.ceil(input.config.salvage.poolTtlMinutes * 6e4 / Math.max(1, input.tickRateMs));
    const ttlMs = input.config.salvage.poolTtlMinutes * 6e4;
    const freshPool = pool.filter((entry) => isSalvageEntryFresh(entry, input.state.root.tick, ttlTicks, ttlMs));
    const expiredPool = pool.filter((entry) => !freshPool.includes(entry));
    const ownedCount = getOwnedRecyclingCenterCount(input.state, input.playerId, input.config);
    return {
      ownedCount,
      salvageRatePct: resolveRecyclingCenterSalvageRatePct(ownedCount, input.config),
      freshPool,
      expiredPool
    };
  };
  const appendSalvagePoolEntries = (state, playerId, entries, sourceId = "loss") => {
    if (!playerId || entries.length <= 0) return state;
    const player = state.playersById[playerId];
    if (!player) return state;
    const safeEntries = entries.filter((entry) => Math.floor(Number(entry.amount || 0)) > 0 && entry.itemId).map((entry, index) => ({
      ...entry,
      amount: Math.floor(Number(entry.amount || 0)),
      id: `salvage:${state.root.tick}:${sourceId}:${index}:${entry.itemId}`,
      lostAtTick: state.root.tick,
      lostAt: (/* @__PURE__ */ new Date(0)).toISOString()
    }));
    if (safeEntries.length <= 0) return state;
    return {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: {
          ...player,
          salvagePool: [...player.salvagePool ?? [], ...safeEntries],
          version: player.version + 1
        }
      }
    };
  };
  const createSalvageEntriesFromLosses = (losses, source, config) => Object.entries(losses ?? {}).flatMap(([itemId, amount]) => {
    const item = config == null ? void 0 : config.salvage.recoverableItems[itemId];
    const safeAmount = Math.floor(Number(amount || 0));
    if (!item || safeAmount <= 0) {
      return [];
    }
    return [{
      itemId,
      itemName: item.itemName,
      category: item.category,
      amount: safeAmount,
      source
    }];
  });
  const resolveRecyclingCenterAction = (input) => {
    const config = input.recyclingCenterConfig;
    if (input.actionId !== config.extractLosses.actionId) return null;
    const stats = resolveRecyclingCenterSalvageStats({
      state: input.state,
      playerId: input.playerId,
      config,
      tickRateMs: input.tickRateMs
    });
    const nextBalances = {
      ...input.balances,
      cash: Math.max(0, Number(input.balances.cash || 0) - config.extractLosses.cleanCashCost)
    };
    const random = input.random ?? Math.random;
    const recovered = {};
    const recoveredByCategory = {};
    const lostByCapacity = {};
    const capacity = input.warehouseConfig ? resolveWarehouseStorageCapacity(input.state, input.playerId, input.warehouseConfig, input.powerStationConfig) : null;
    const rate = stats.salvageRatePct / 100;
    for (const entry of stats.freshPool) {
      const raw = Math.max(0, Number(entry.amount || 0)) * rate;
      let amount = Math.floor(raw);
      if (config.salvage.rareItems.includes(entry.itemId) && random() < raw - amount) {
        amount += 1;
      }
      if (amount <= 0) continue;
      const cap = capacity ? getWarehouseCapacityForResource(capacity, entry.itemId) : Number.POSITIVE_INFINITY;
      const current = Math.max(0, Number(nextBalances[entry.itemId] || 0));
      const accepted = Number.isFinite(cap) ? Math.max(0, Math.min(amount, cap - current)) : amount;
      const overflow = Math.max(0, amount - accepted);
      if (accepted > 0) {
        nextBalances[entry.itemId] = current + accepted;
        recovered[entry.itemId] = Math.max(0, Number(recovered[entry.itemId] || 0) + accepted);
        recoveredByCategory[entry.category] = Math.max(0, Number(recoveredByCategory[entry.category] || 0) + accepted);
      }
      if (overflow > 0) {
        lostByCapacity[entry.itemId] = Math.max(0, Number(lostByCapacity[entry.itemId] || 0) + overflow);
      }
    }
    return {
      balances: nextBalances,
      playerSalvagePool: [],
      heatGain: config.extractLosses.heatGain,
      influenceChange: 0,
      inputCost: { cash: config.extractLosses.cleanCashCost },
      outputGain: recovered,
      reportText: "Recyklační centrum vytěžilo část ztracených itemů ze šrotu.",
      recyclingResult: {
        type: "salvage_recovery",
        salvageRatePct: stats.salvageRatePct,
        recovered,
        recoveredByCategory,
        lostByCapacity,
        expiredCount: stats.expiredPool.reduce((total, entry) => total + Math.max(0, Number(entry.amount || 0)), 0),
        cleanCashCost: config.extractLosses.cleanCashCost,
        heatGain: config.extractLosses.heatGain,
        noPopulationRecovery: true
      }
    };
  };
  const validateRecyclingCenterAction = (input) => {
    const config = input.recyclingCenterConfig;
    if (!config || input.actionId !== config.extractLosses.actionId) return null;
    if (Math.max(0, Number(input.balances.cash || 0)) < config.extractLosses.cleanCashCost) return "recycling_insufficient_clean_cash";
    const stats = resolveRecyclingCenterSalvageStats({
      state: input.state,
      playerId: input.playerId,
      config,
      tickRateMs: input.tickRateMs
    });
    return stats.freshPool.length > 0 ? null : "recycling_salvage_pool_empty";
  };
  const applyRecyclingCenterIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return {
        cleanPerHour: input.cleanPerHour,
        dirtyPerHour: input.dirtyPerHour,
        heatPerDay: input.heatPerDay,
        influencePerDay: input.influencePerDay,
        maxLevel: 1
      };
    }
    const network = resolveRecyclingCenterNetworkMultipliers(getOwnedRecyclingCenterCount(input.state, input.building.ownerPlayerId, input.config), input.config);
    return {
      cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
      dirtyPerHour: 0,
      heatPerDay: input.heatPerDay * network.heatMultiplier,
      influencePerDay: 0,
      maxLevel: 1
    };
  };
  const isSalvageEntryFresh = (entry, nowTick, ttlTicks, ttlMs) => {
    const lostAtTick = Number(entry.lostAtTick);
    if (Number.isFinite(lostAtTick)) {
      return nowTick - Math.max(0, lostAtTick) <= ttlTicks;
    }
    const lostAtMs = entry.lostAt ? Date.parse(entry.lostAt) : Number.NaN;
    return Number.isFinite(lostAtMs) ? Date.now() - lostAtMs <= ttlMs : true;
  };
  const getOwnedRestaurantCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolveRestaurantNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraRestaurant / 100),
      influenceMultiplier: Math.min(config.network.maxInfluenceMultiplier, 1 + extra * config.network.influenceBonusPctPerExtraRestaurant / 100),
      rumorMultiplier: Math.min(config.network.maxRumorMultiplier, 1 + extra * config.network.rumorChanceBonusPctPerExtraRestaurant / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraRestaurant / 100)
    };
  };
  const resolveRestaurantRumorStats = (input) => {
    const restaurantCount = getOwnedRestaurantCount(input.state, input.playerId, input.config);
    const network = resolveRestaurantNetworkMultipliers(restaurantCount, input.config);
    const baseTruthChancePct = resolveTruthChancePct(restaurantCount, input.config);
    return {
      restaurantCount,
      network,
      passiveRumorChancePct: Math.min(100, input.config.baseRumorChancePct * network.rumorMultiplier),
      truthChancePct: Math.min(100, baseTruthChancePct),
      districtHintChancePct: input.config.districtHintChancePct,
      buildingHintChancePct: input.config.buildingHintChancePct,
      reliabilityVisible: false
    };
  };
  const applyRestaurantIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return {
        cleanPerHour: input.cleanPerHour,
        dirtyPerHour: input.dirtyPerHour,
        heatPerDay: input.heatPerDay,
        influencePerDay: input.influencePerDay,
        maxLevel: 1
      };
    }
    const network = resolveRestaurantNetworkMultipliers(getOwnedRestaurantCount(input.state, input.building.ownerPlayerId, input.config), input.config);
    return {
      cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
      dirtyPerHour: 0,
      heatPerDay: input.heatPerDay * network.heatMultiplier,
      influencePerDay: input.influencePerDay * network.influenceMultiplier,
      maxLevel: 1
    };
  };
  const applyRestaurantPassiveRumors = (state, config, tickRateMs) => {
    const intervalTicks = minutesToTicks$1(config.passiveRumorIntervalMinutes, tickRateMs);
    let buildingsById = state.buildingsById;
    let changed = false;
    for (const building2 of Object.values(state.buildingsById)) {
      if (building2.buildingTypeId !== config.buildingTypeId || building2.status !== "active" || !building2.ownerPlayerId) {
        continue;
      }
      const metadata = cleanupRestaurantMetadata(getRestaurantMetadata(building2));
      if (metadata.lastPassiveRumorCheckTick === void 0) {
        metadata.lastPassiveRumorCheckTick = state.root.tick;
        buildingsById = updateBuildingMetadata(buildingsById, building2, metadata);
        changed = true;
        continue;
      }
      if ((metadata.lastPassiveRumorCheckTick ?? -Infinity) + intervalTicks > state.root.tick) {
        continue;
      }
      const stats = resolveRestaurantRumorStats({ state, playerId: building2.ownerPlayerId, config });
      metadata.lastPassiveRumorCheckTick = state.root.tick;
      if (deterministicRollPct$1(`${building2.id}:restaurant-passive-rumor:${state.root.tick}`) < stats.passiveRumorChancePct) {
        metadata.rumorEvents.push(generateRestaurantRumor({
          state,
          playerId: building2.ownerPlayerId,
          config,
          seed: `${building2.id}:restaurant-rumor-event:${state.root.tick}`
        }));
      }
      buildingsById = updateBuildingMetadata(buildingsById, building2, metadata);
      changed = true;
    }
    return changed ? { ...state, buildingsById } : state;
  };
  const getRestaurantMetadata = (building2) => {
    var _a;
    const raw = isRecord$4((_a = building2.metadata) == null ? void 0 : _a.restaurant) ? building2.metadata.restaurant : {};
    return {
      lastPassiveRumorCheckTick: asOptionalTick$2(raw.lastPassiveRumorCheckTick),
      rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord$4).map(normalizeRumor$1).slice(-12) : []
    };
  };
  const updateBuildingMetadata = (buildingsById, building2, metadata) => ({
    ...buildingsById,
    [building2.id]: {
      ...building2,
      metadata: withRestaurantMetadata(building2, cleanupRestaurantMetadata(metadata)),
      version: building2.version + 1
    }
  });
  const generateRestaurantRumor = (input) => {
    const stats = resolveRestaurantRumorStats({ state: input.state, playerId: input.playerId, config: input.config });
    const type = input.config.rumorTypes[Math.floor(deterministicRollPct$1(`${input.seed}:type`) / 100 * input.config.rumorTypes.length)] ?? "fake";
    const isTrue = deterministicRollPct$1(`${input.seed}:truth`) < stats.truthChancePct;
    const districtHint = deterministicRollPct$1(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint$1(input.state, input.seed) : null;
    const buildingHint = deterministicRollPct$1(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint$1(input.state, input.seed) : null;
    const reliabilityLabel = stats.reliabilityVisible ? formatReliability(stats.truthChancePct) : null;
    return {
      type,
      truthChancePct: stats.truthChancePct,
      isTrue,
      districtHint,
      buildingHint,
      reliabilityVisible: stats.reliabilityVisible,
      reliabilityLabel,
      text: formatRumorText$1(type, isTrue, districtHint, buildingHint, reliabilityLabel)
    };
  };
  const formatRumorText$1 = (type, isTrue, districtHint, buildingHint, reliabilityLabel) => {
    const subject = isTrue ? type : "fake";
    const detail = districtHint ? buildingHint ? ` poblíž ${districtHint}; mluvilo se i o budově typu ${buildingHint}` : ` poblíž ${districtHint}` : buildingHint ? ` kolem budovy typu ${buildingHint}` : " někde ve městě";
    const reliability = reliabilityLabel ? ` Spolehlivost: ${reliabilityLabel}.` : "";
    return `Hosté mluvili o ${formatRumorSubject(subject)}${detail}.${reliability}`;
  };
  const formatRumorSubject = (type) => {
    switch (type) {
      case "civilian_movement":
        return "neobvyklém pohybu lidí";
      case "suspicious_delivery":
        return "podezřelé dodávce";
      case "police_interest":
        return "zájmu policie";
      case "economic_activity":
        return "nezvyklé ekonomické aktivitě";
      case "storage_movement":
        return "pohybu zásob";
      case "attack_preparation":
        return "možné přípravě útoku";
      case "weak_defense":
        return "slabší obraně";
      default:
        return "neověřené historce";
    }
  };
  const resolveTruthChancePct = (count, config) => {
    const safeCount = Math.max(0, Math.floor(Number(count || 0)));
    const tier = config.truthChanceByOwnedCount.find(
      (candidate) => safeCount >= candidate.minOwned && (candidate.maxOwned === null || safeCount <= candidate.maxOwned)
    );
    return (tier == null ? void 0 : tier.truthChancePct) ?? 0;
  };
  const formatReliability = (truthChancePct) => truthChancePct >= 60 ? "střední" : truthChancePct >= 50 ? "nízká až střední" : "nízká";
  const cleanupRestaurantMetadata = (metadata) => ({
    ...metadata,
    rumorEvents: metadata.rumorEvents.slice(-12)
  });
  const withRestaurantMetadata = (building2, restaurant) => ({
    ...building2.metadata ?? {},
    restaurant
  });
  const pickDistrictHint$1 = (state, seed) => {
    var _a;
    const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
    return districts.length > 0 ? ((_a = districts[Math.floor(deterministicRollPct$1(`${seed}:district-index`) / 100 * districts.length)]) == null ? void 0 : _a.name) ?? null : null;
  };
  const pickBuildingHint$1 = (state, seed) => {
    var _a;
    const buildings = Object.values(state.buildingsById).filter((building2) => building2.status === "active");
    return buildings.length > 0 ? ((_a = buildings[Math.floor(deterministicRollPct$1(`${seed}:building-index`) / 100 * buildings.length)]) == null ? void 0 : _a.buildingTypeId) ?? null : null;
  };
  const normalizeRumor$1 = (value) => ({
    type: String(value.type || "fake"),
    truthChancePct: Math.max(0, Number(value.truthChancePct || 0)),
    isTrue: Boolean(value.isTrue),
    districtHint: value.districtHint ? String(value.districtHint) : null,
    buildingHint: value.buildingHint ? String(value.buildingHint) : null,
    reliabilityVisible: Boolean(value.reliabilityVisible),
    reliabilityLabel: value.reliabilityLabel ? String(value.reliabilityLabel) : null,
    text: String(value.text || "")
  });
  const minutesToTicks$1 = (minutes, tickRateMs) => Math.max(1, Math.ceil(Math.max(0, Number(minutes || 0)) * 60 * 1e3 / Math.max(1, tickRateMs)));
  const deterministicRollPct$1 = (seed) => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 1e4 / 100;
  };
  const asOptionalTick$2 = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : void 0;
  };
  const isRecord$4 = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const getOwnedShoppingMallCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolveShoppingMallNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      cleanIncomeMultiplier: Math.min(config.network.maxCleanIncomeMultiplier, 1 + extra * config.network.cleanIncomeBonusPctPerExtraMall / 100),
      dirtyIncomeMultiplier: Math.min(config.network.maxDirtyIncomeMultiplier, 1 + extra * config.network.dirtyIncomeBonusPctPerExtraMall / 100),
      influenceMultiplier: Math.min(config.network.maxInfluenceMultiplier, 1 + extra * config.network.influenceBonusPctPerExtraMall / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraMall / 100)
    };
  };
  const resolveShoppingMallMarketBonuses = (count, config) => {
    const baseDiscountPct = Math.min(
      config.marketDiscount.maxDiscountPct,
      Math.max(0, Math.floor(Number(count || 0))) * config.marketDiscount.discountPctPerMall
    );
    return {
      ownedCount: Math.max(0, Math.floor(Number(count || 0))),
      regularMarketDiscountPct: baseDiscountPct * config.marketDiscount.regularMarketWeight,
      blackMarketDiscountPct: baseDiscountPct * config.marketDiscount.blackMarketWeight,
      playerMarketDiscountPct: baseDiscountPct * config.marketDiscount.playerMarketWeight,
      emergencyMarketDiscountPct: baseDiscountPct * config.marketDiscount.emergencyMarketWeight,
      marketFeeReductionPct: Math.min(
        config.marketFeeReduction.maxFeeReductionPct,
        Math.max(0, Math.floor(Number(count || 0))) * config.marketFeeReduction.feeReductionPctPerMall
      ),
      minFinalPriceMultiplier: config.marketDiscount.minFinalPriceMultiplier
    };
  };
  const applyShoppingMallIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return {
        cleanPerHour: input.cleanPerHour,
        dirtyPerHour: input.dirtyPerHour,
        heatPerDay: input.heatPerDay,
        influencePerDay: input.influencePerDay,
        maxLevel: 1
      };
    }
    const network = resolveShoppingMallNetworkMultipliers(getOwnedShoppingMallCount(input.state, input.building.ownerPlayerId, input.config), input.config);
    return {
      cleanPerHour: input.cleanPerHour * network.cleanIncomeMultiplier,
      dirtyPerHour: input.dirtyPerHour * network.dirtyIncomeMultiplier,
      heatPerDay: input.heatPerDay * network.heatMultiplier,
      influencePerDay: input.influencePerDay * network.influenceMultiplier,
      maxLevel: 1
    };
  };
  const getOwnedStripClubCount = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  ).length;
  const resolveStripClubNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraStripClub / 100),
      influenceMultiplier: Math.min(config.network.maxInfluenceMultiplier, 1 + extra * config.network.influenceBonusPctPerExtraStripClub / 100),
      rumorMultiplier: Math.min(config.network.maxRumorMultiplier, 1 + extra * config.network.rumorChanceBonusPctPerExtraStripClub / 100),
      heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraStripClub / 100)
    };
  };
  const resolveStripClubRumorStats = (input) => {
    const stripClubCount = getOwnedStripClubCount(input.state, input.playerId, input.config);
    const network = resolveStripClubNetworkMultipliers(stripClubCount, input.config);
    return {
      stripClubCount,
      network,
      passiveRumorChancePct: Math.min(100, input.config.baseRumorChancePct * network.rumorMultiplier + (input.vipActive ? input.config.vipLounge.rumorChanceFlatBonusPct : 0)),
      truthChancePct: Math.min(
        input.config.maxTruthChancePct,
        input.config.baseTruthChancePct + Math.max(0, stripClubCount - 1) * input.config.truthChancePctPerExtraClub
      ),
      districtHintChancePct: input.config.districtHintChancePct,
      buildingHintChancePct: input.config.buildingHintChancePct,
      probabilityVisible: false,
      verifiedIntelEligible: false
    };
  };
  const applyStripClubIncomeModifiers = (input) => {
    if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
      return {
        cleanPerHour: input.cleanPerHour,
        dirtyPerHour: input.dirtyPerHour,
        heatPerDay: input.heatPerDay,
        influencePerDay: input.influencePerDay,
        maxLevel: 1
      };
    }
    const metadata = cleanupStripClubMetadata(getStripClubMetadata(input.building), input.tick);
    const network = resolveStripClubNetworkMultipliers(getOwnedStripClubCount(input.state, input.building.ownerPlayerId, input.config), input.config);
    const vipActive = (metadata.vipLoungeExpiresAtTick ?? 0) > input.tick;
    const partyActive = (metadata.privatePartyExpiresAtTick ?? 0) > input.tick;
    return {
      cleanPerHour: input.cleanPerHour * network.incomeMultiplier * (vipActive ? 1 + input.config.vipLounge.cleanIncomeBonusPct / 100 : 1),
      dirtyPerHour: input.dirtyPerHour * network.incomeMultiplier * (vipActive ? 1 + input.config.vipLounge.dirtyIncomeBonusPct / 100 : 1),
      heatPerDay: input.heatPerDay * network.heatMultiplier * (vipActive ? 1 + input.config.vipLounge.heatBonusPct / 100 : 1),
      influencePerDay: input.influencePerDay * network.influenceMultiplier * (vipActive ? 1 + input.config.vipLounge.influenceBonusPct / 100 : 1) * (partyActive ? 1 + input.config.privateParty.influenceProductionBonusPct / 100 : 1),
      maxLevel: 1
    };
  };
  const resolveStripClubAction = (input) => {
    const config = input.stripClubConfig;
    if (input.building.buildingTypeId !== config.buildingTypeId) {
      return null;
    }
    const metadata = cleanupStripClubMetadata(getStripClubMetadata(input.building), input.state.root.tick);
    if (input.action.actionId === config.vipLounge.actionId) {
      metadata.vipLoungeExpiresAtTick = input.state.root.tick + minutesToTicks(config.vipLounge.durationMinutes, input.tickRateMs);
      return {
        balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - config.vipLounge.cleanCashCost) },
        buildingMetadata: withStripClubMetadata(input.building, metadata),
        heatGain: 0,
        influenceChange: 0,
        inputCost: { cash: config.vipLounge.cleanCashCost },
        outputGain: {},
        effectModifiers: input.action.effectModifiers,
        reportText: `VIP salonek aktivní ${config.vipLounge.durationMinutes} minut. Rumor chance +${config.vipLounge.rumorChanceFlatBonusPct} %.`,
        stripClubResult: { type: "temporary_boost", activeUntilTick: metadata.vipLoungeExpiresAtTick, rumorChanceFlatBonusPct: config.vipLounge.rumorChanceFlatBonusPct }
      };
    }
    if (input.action.actionId === config.barWhispers.actionId) {
      const rumor = generateStripClubRumor({
        state: input.state,
        playerId: input.building.ownerPlayerId ?? "",
        buildingId: input.building.id,
        config,
        seed: `${input.commandId}:bar:${input.state.root.tick}`
      });
      metadata.rumorEvents.push(rumor);
      return {
        balances: { ...input.balances },
        buildingMetadata: withStripClubMetadata(input.building, metadata),
        heatGain: config.barWhispers.heatGain,
        influenceChange: -config.barWhispers.influenceCost,
        inputCost: { influence: config.barWhispers.influenceCost },
        outputGain: {},
        reportText: `Šeptanda u baru: ${rumor.text}`,
        stripClubResult: { type: "rumor_generation", rumor }
      };
    }
    if (input.action.actionId === config.privateParty.actionId) {
      metadata.privatePartyExpiresAtTick = input.state.root.tick + minutesToTicks(config.privateParty.durationMinutes, input.tickRateMs);
      const extraRumor = deterministicRollPct(`${input.commandId}:extra-rumor:${input.state.root.tick}`) < config.privateParty.extraRumorChancePct ? generateStripClubRumor({
        state: input.state,
        playerId: input.building.ownerPlayerId ?? "",
        buildingId: input.building.id,
        config,
        seed: `${input.commandId}:party-rumor:${input.state.root.tick}`
      }) : null;
      const contact = deterministicRollPct(`${input.commandId}:contact:${input.state.root.tick}`) < config.privateParty.contactChancePct ? resolveContact(config, input.commandId, input.state.root.tick, input.tickRateMs) : null;
      const scandal = deterministicRollPct(`${input.commandId}:scandal:${input.state.root.tick}`) < config.privateParty.scandalChancePct;
      if (extraRumor) {
        metadata.rumorEvents.push(extraRumor);
      }
      if (contact) {
        metadata.contacts.push(contact);
      }
      if (scandal) {
        const scandalRumor = generateStripClubRumor({
          state: input.state,
          playerId: input.building.ownerPlayerId ?? "",
          buildingId: input.building.id,
          config,
          seed: `${input.commandId}:scandal-rumor:${input.state.root.tick}`,
          forcedType: "relationships",
          forcedFalse: false
        });
        metadata.rumorEvents.push(scandalRumor);
        metadata.scandalEvents.push({ tick: input.state.root.tick, rumor: scandalRumor });
      }
      return {
        balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - config.privateParty.cleanCashCost) },
        buildingMetadata: withStripClubMetadata(input.building, metadata),
        heatGain: config.privateParty.heatGain + (scandal ? config.privateParty.scandalHeatGain : 0),
        influenceChange: config.privateParty.instantInfluenceGain - (scandal ? config.privateParty.scandalInfluenceLoss : 0),
        inputCost: { cash: config.privateParty.cleanCashCost },
        outputGain: {},
        effectModifiers: input.action.effectModifiers,
        reportText: scandal ? "Soukromá party skončila skandálem. Heat výrazně vzrostl a vliv klesl." : "Soukromá party přinesla vliv a zákulisní příležitosti.",
        stripClubResult: {
          type: "influence_contact_event",
          activeUntilTick: metadata.privatePartyExpiresAtTick,
          extraRumor,
          contact,
          scandal,
          scandalRiskPct: config.privateParty.scandalChancePct
        }
      };
    }
    return null;
  };
  const validateStripClubAction = (input) => {
    const config = input.stripClubConfig;
    if (!config || input.building.buildingTypeId !== config.buildingTypeId) {
      return null;
    }
    const metadata = getStripClubMetadata(input.building);
    if (input.actionId === config.vipLounge.actionId && (metadata.vipLoungeExpiresAtTick ?? 0) > input.state.root.tick) {
      return "strip_club_vip_lounge_active";
    }
    if (input.actionId === config.privateParty.actionId && (metadata.privatePartyExpiresAtTick ?? 0) > input.state.root.tick) {
      return "strip_club_private_party_active";
    }
    if (input.actionId === config.barWhispers.actionId && Math.max(0, Number(input.district.influence || 0)) < config.barWhispers.influenceCost) {
      return "strip_club_insufficient_influence";
    }
    return null;
  };
  const applyStripClubPassiveRumors = (state, config, tickRateMs) => {
    const intervalTicks = minutesToTicks(config.passiveRumorIntervalMinutes, tickRateMs);
    let buildingsById = state.buildingsById;
    let changed = false;
    for (const building2 of Object.values(state.buildingsById)) {
      if (building2.buildingTypeId !== config.buildingTypeId || building2.status !== "active" || !building2.ownerPlayerId) {
        continue;
      }
      const metadata = cleanupStripClubMetadata(getStripClubMetadata(building2), state.root.tick);
      if (metadata.lastPassiveRumorCheckTick === void 0) {
        metadata.lastPassiveRumorCheckTick = state.root.tick;
        buildingsById = {
          ...buildingsById,
          [building2.id]: {
            ...building2,
            metadata: withStripClubMetadata(building2, metadata),
            version: building2.version + 1
          }
        };
        changed = true;
        continue;
      }
      if ((metadata.lastPassiveRumorCheckTick ?? -Infinity) + intervalTicks > state.root.tick) {
        continue;
      }
      const stats = resolveStripClubRumorStats({
        state,
        playerId: building2.ownerPlayerId,
        config,
        vipActive: (metadata.vipLoungeExpiresAtTick ?? 0) > state.root.tick
      });
      metadata.lastPassiveRumorCheckTick = state.root.tick;
      if (deterministicRollPct(`${building2.id}:passive-rumor:${state.root.tick}`) < stats.passiveRumorChancePct) {
        metadata.rumorEvents.push(generateStripClubRumor({
          state,
          playerId: building2.ownerPlayerId,
          buildingId: building2.id,
          config,
          seed: `${building2.id}:passive-rumor-event:${state.root.tick}`
        }));
      }
      buildingsById = {
        ...buildingsById,
        [building2.id]: {
          ...building2,
          metadata: withStripClubMetadata(building2, metadata),
          version: building2.version + 1
        }
      };
      changed = true;
    }
    return changed ? { ...state, buildingsById } : state;
  };
  const getStripClubMetadata = (building2) => {
    var _a;
    const raw = isRecord$3((_a = building2.metadata) == null ? void 0 : _a.stripClub) ? building2.metadata.stripClub : {};
    return {
      vipLoungeExpiresAtTick: asOptionalTick$1(raw.vipLoungeExpiresAtTick),
      privatePartyExpiresAtTick: asOptionalTick$1(raw.privatePartyExpiresAtTick),
      lastPassiveRumorCheckTick: asOptionalTick$1(raw.lastPassiveRumorCheckTick),
      rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord$3).map(normalizeRumor).slice(-12) : [],
      contacts: Array.isArray(raw.contacts) ? raw.contacts.filter(isRecord$3).map(normalizeContact).slice(-8) : [],
      scandalEvents: Array.isArray(raw.scandalEvents) ? raw.scandalEvents.filter(isRecord$3).slice(-8) : []
    };
  };
  const generateStripClubRumor = (input) => {
    const stats = resolveStripClubRumorStats({ state: input.state, playerId: input.playerId, config: input.config });
    const type = input.forcedType ?? input.config.rumorTypes[Math.floor(deterministicRollPct(`${input.seed}:type`) / 100 * input.config.rumorTypes.length)] ?? "fake";
    const isTrue = input.forcedFalse === true ? false : deterministicRollPct(`${input.seed}:truth`) < stats.truthChancePct;
    const districtHint = deterministicRollPct(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint(input.state, input.seed) : null;
    const buildingHint = deterministicRollPct(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint(input.state, input.seed) : null;
    const verifiedIntel = stats.verifiedIntelEligible && isTrue && deterministicRollPct(`${input.seed}:verified`) < 18;
    return {
      type,
      truthChancePct: stats.truthChancePct,
      isTrue,
      districtHint,
      buildingHint,
      probabilityVisible: stats.probabilityVisible,
      verifiedIntel,
      text: formatRumorText(type, isTrue, districtHint, buildingHint, verifiedIntel)
    };
  };
  const formatRumorText = (type, isTrue, districtHint, buildingHint, verifiedIntel) => {
    const prefix = verifiedIntel ? "Ověřený zákulisní intel" : "Drb z podsvětí";
    const truth = isTrue ? "může sedět" : "může být nastrčený";
    const detail = [districtHint ? `district: ${districtHint}` : "", buildingHint ? `budova: ${buildingHint}` : ""].filter(Boolean).join(", ");
    return `${prefix}: ${type}, ${truth}${detail ? ` (${detail})` : ""}.`;
  };
  const pickDistrictHint = (state, seed) => {
    var _a;
    const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
    return districts.length > 0 ? ((_a = districts[Math.floor(deterministicRollPct(`${seed}:district-index`) / 100 * districts.length)]) == null ? void 0 : _a.name) ?? null : null;
  };
  const pickBuildingHint = (state, seed) => {
    var _a;
    const buildings = Object.values(state.buildingsById).filter((building2) => building2.status === "active");
    return buildings.length > 0 ? ((_a = buildings[Math.floor(deterministicRollPct(`${seed}:building-index`) / 100 * buildings.length)]) == null ? void 0 : _a.buildingTypeId) ?? null : null;
  };
  const resolveContact = (config, commandId, tick, tickRateMs) => {
    const contact = config.contacts[Math.floor(deterministicRollPct(`${commandId}:contact-kind:${tick}`) / 100 * config.contacts.length)] ?? config.contacts[0];
    return {
      id: contact.id,
      label: contact.label,
      effectSummary: contact.effectSummary,
      expiresAtTick: contact.durationMinutes ? tick + minutesToTicks(contact.durationMinutes, tickRateMs) : null,
      gainedAtTick: tick
    };
  };
  const cleanupStripClubMetadata = (metadata, tick) => ({
    ...metadata,
    vipLoungeExpiresAtTick: (metadata.vipLoungeExpiresAtTick ?? 0) > tick ? metadata.vipLoungeExpiresAtTick : void 0,
    privatePartyExpiresAtTick: (metadata.privatePartyExpiresAtTick ?? 0) > tick ? metadata.privatePartyExpiresAtTick : void 0,
    rumorEvents: metadata.rumorEvents.slice(-12),
    contacts: metadata.contacts.filter((contact) => contact.expiresAtTick === null || contact.expiresAtTick > tick).slice(-8),
    scandalEvents: metadata.scandalEvents.slice(-8)
  });
  const withStripClubMetadata = (building2, stripClub) => ({
    ...building2.metadata ?? {},
    stripClub
  });
  const normalizeRumor = (value) => ({
    type: String(value.type || "fake"),
    truthChancePct: Math.max(0, Number(value.truthChancePct || 0)),
    isTrue: Boolean(value.isTrue),
    districtHint: value.districtHint ? String(value.districtHint) : null,
    buildingHint: value.buildingHint ? String(value.buildingHint) : null,
    probabilityVisible: Boolean(value.probabilityVisible),
    verifiedIntel: Boolean(value.verifiedIntel),
    text: String(value.text || "")
  });
  const normalizeContact = (value) => ({
    id: String(value.id || ""),
    label: String(value.label || ""),
    effectSummary: String(value.effectSummary || ""),
    expiresAtTick: value.expiresAtTick === null ? null : asOptionalTick$1(value.expiresAtTick) ?? null,
    gainedAtTick: Math.max(0, Math.floor(Number(value.gainedAtTick || 0)))
  });
  const minutesToTicks = (minutes, tickRateMs) => Math.max(1, Math.ceil(Math.max(0, Number(minutes || 0)) * 60 * 1e3 / Math.max(1, tickRateMs)));
  const deterministicRollPct = (seed) => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 1e4 / 100;
  };
  const asOptionalTick$1 = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : void 0;
  };
  const isRecord$3 = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const HOUR_MS = 60 * 60 * 1e3;
  const calculateIncomeByPlayerId = (state, context) => {
    const incomeByPlayerId = {};
    for (const district of Object.values(state.districtsById)) {
      if (!district.ownerPlayerId || district.status === "destroyed") {
        continue;
      }
      for (const [resourceKey, rawAmount] of Object.entries(district.resourceModifiers)) {
        addIncome(incomeByPlayerId, district.ownerPlayerId, resourceKey, rawAmount);
      }
      if (!context) {
        continue;
      }
      const fixedBuildingIncome = calculateFixedBuildingIncomeForDistrict(state, district, context);
      addIncome(incomeByPlayerId, district.ownerPlayerId, "cash", fixedBuildingIncome.cash);
      addIncome(incomeByPlayerId, district.ownerPlayerId, "dirty-cash", fixedBuildingIncome.dirtyCash);
    }
    return incomeByPlayerId;
  };
  const getActiveFixedBuildingConfigsForDistrict = (state, district, context) => {
    const fixedBuildings = context.config.balance.fixedBuildings;
    if (!fixedBuildings || !district.ownerPlayerId || district.status === "destroyed") {
      return [];
    }
    return district.buildingIds.flatMap((buildingId) => {
      const building2 = state.buildingsById[buildingId];
      if (!building2 || building2.status !== "active" || building2.ownerPlayerId !== district.ownerPlayerId) {
        return [];
      }
      const config = fixedBuildings[building2.buildingTypeId];
      return config ? [{ building: building2, config }] : [];
    });
  };
  const resolveActiveDistrictEffectModifiers = (state, districtId) => {
    const effectStates = Object.values(state.effectStatesById).filter(
      (effectState) => effectState.ownerType === "district" && effectState.ownerId === districtId
    );
    const resolved = createDefaultDistrictEffectModifiers();
    for (const effectState of effectStates) {
      for (const effect of effectState.effects) {
        if (effect.expiresAtTick !== null && effect.expiresAtTick <= state.root.tick) {
          continue;
        }
        const modifiers = extractEffectModifiers(effect.payload);
        multiplyModifier(resolved, "incomeMultiplier", modifiers.incomeMultiplier);
        multiplyModifier(resolved, "cleanIncomeMultiplier", modifiers.cleanIncomeMultiplier);
        multiplyModifier(resolved, "dirtyIncomeMultiplier", modifiers.dirtyIncomeMultiplier);
        multiplyModifier(resolved, "influenceMultiplier", modifiers.influenceMultiplier);
        multiplyModifier(resolved, "heatMultiplier", modifiers.heatMultiplier);
        multiplyModifier(resolved, "attackMultiplier", modifiers.attackMultiplier);
        multiplyModifier(resolved, "defenseMultiplier", modifiers.defenseMultiplier);
        addModifier(resolved, "influencePerDay", modifiers.influencePerDay);
        addModifier(resolved, "heatPerDay", modifiers.heatPerDay);
      }
    }
    return resolved;
  };
  const createDefaultDistrictEffectModifiers = () => ({
    incomeMultiplier: 1,
    cleanIncomeMultiplier: 1,
    dirtyIncomeMultiplier: 1,
    influenceMultiplier: 1,
    heatMultiplier: 1,
    influencePerDay: 0,
    heatPerDay: 0,
    attackMultiplier: 1,
    defenseMultiplier: 1
  });
  const calculateFixedBuildingIncomeForDistrict = (state, district, context) => {
    const activeBuildings = getActiveFixedBuildingConfigsForDistrict(state, district, context);
    if (activeBuildings.length === 0) {
      return { cash: 0, dirtyCash: 0 };
    }
    const ticksPerHour = HOUR_MS / Math.max(1, context.config.tickRateMs);
    const modifiers = resolveActiveDistrictEffectModifiers(state, district.id);
    const incomeMultiplier = Math.max(0, Number(context.config.balance.incomeMultiplier || 0)) * modifiers.incomeMultiplier;
    return activeBuildings.reduce(
      (totals, { building: building2, config }) => {
        const casinoConfig = context.config.balance.casino ? applyCasinoIncomeModifiers({
          config: context.config.balance.casino,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: config.cleanPerHour,
          dirtyPerHour: config.dirtyPerHour,
          heatPerDay: config.heatPerDay,
          influencePerDay: config.influencePerDay
        }) : config;
        const activeConfig = context.config.balance.exchangeOffice ? applyExchangeOfficeIncomeModifiers({
          config: context.config.balance.exchangeOffice,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: casinoConfig.cleanPerHour,
          dirtyPerHour: casinoConfig.dirtyPerHour,
          heatPerDay: casinoConfig.heatPerDay,
          influencePerDay: casinoConfig.influencePerDay
        }) : casinoConfig;
        const finalConfig = context.config.balance.arcade ? applyArcadeIncomeModifiers({
          config: context.config.balance.arcade,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: activeConfig.cleanPerHour,
          dirtyPerHour: activeConfig.dirtyPerHour,
          heatPerDay: activeConfig.heatPerDay,
          influencePerDay: activeConfig.influencePerDay
        }) : activeConfig;
        const warehouseConfig = context.config.balance.warehouse ? applyWarehouseIncomeModifiers({
          config: context.config.balance.warehouse,
          state,
          building: building2,
          cleanPerHour: finalConfig.cleanPerHour,
          dirtyPerHour: finalConfig.dirtyPerHour,
          heatPerDay: finalConfig.heatPerDay,
          influencePerDay: finalConfig.influencePerDay
        }) : finalConfig;
        const clinicConfig = context.config.balance.clinic ? applyClinicIncomeModifiers({
          config: context.config.balance.clinic,
          state,
          building: building2,
          cleanPerHour: warehouseConfig.cleanPerHour,
          dirtyPerHour: warehouseConfig.dirtyPerHour,
          heatPerDay: warehouseConfig.heatPerDay,
          influencePerDay: warehouseConfig.influencePerDay
        }) : warehouseConfig;
        const stripClubConfig = context.config.balance.stripClub ? applyStripClubIncomeModifiers({
          config: context.config.balance.stripClub,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: clinicConfig.cleanPerHour,
          dirtyPerHour: clinicConfig.dirtyPerHour,
          heatPerDay: clinicConfig.heatPerDay,
          influencePerDay: clinicConfig.influencePerDay
        }) : clinicConfig;
        const restaurantConfig = context.config.balance.restaurant ? applyRestaurantIncomeModifiers({
          config: context.config.balance.restaurant,
          state,
          building: building2,
          cleanPerHour: stripClubConfig.cleanPerHour,
          dirtyPerHour: stripClubConfig.dirtyPerHour,
          heatPerDay: stripClubConfig.heatPerDay,
          influencePerDay: stripClubConfig.influencePerDay
        }) : stripClubConfig;
        const convenienceStoreConfig = context.config.balance.convenienceStore ? applyConvenienceStoreIncomeModifiers({
          config: context.config.balance.convenienceStore,
          state,
          building: building2,
          cleanPerHour: restaurantConfig.cleanPerHour,
          dirtyPerHour: restaurantConfig.dirtyPerHour,
          heatPerDay: restaurantConfig.heatPerDay,
          influencePerDay: restaurantConfig.influencePerDay
        }) : restaurantConfig;
        const recruitmentCenterConfig = context.config.balance.recruitmentCenter ? applyRecruitmentCenterIncomeModifiers({
          config: context.config.balance.recruitmentCenter,
          state,
          building: building2,
          cleanPerHour: convenienceStoreConfig.cleanPerHour,
          dirtyPerHour: convenienceStoreConfig.dirtyPerHour,
          heatPerDay: convenienceStoreConfig.heatPerDay,
          influencePerDay: convenienceStoreConfig.influencePerDay
        }) : convenienceStoreConfig;
        const shoppingMallConfig = context.config.balance.shoppingMall ? applyShoppingMallIncomeModifiers({
          config: context.config.balance.shoppingMall,
          state,
          building: building2,
          cleanPerHour: recruitmentCenterConfig.cleanPerHour,
          dirtyPerHour: recruitmentCenterConfig.dirtyPerHour,
          heatPerDay: recruitmentCenterConfig.heatPerDay,
          influencePerDay: recruitmentCenterConfig.influencePerDay
        }) : recruitmentCenterConfig;
        const garageConfig = context.config.balance.garage ? applyGarageIncomeModifiers({
          config: context.config.balance.garage,
          state,
          building: building2,
          cleanPerHour: shoppingMallConfig.cleanPerHour,
          dirtyPerHour: shoppingMallConfig.dirtyPerHour,
          heatPerDay: shoppingMallConfig.heatPerDay,
          influencePerDay: shoppingMallConfig.influencePerDay
        }) : shoppingMallConfig;
        const recyclingCenterConfig = context.config.balance.recyclingCenter ? applyRecyclingCenterIncomeModifiers({
          config: context.config.balance.recyclingCenter,
          state,
          building: building2,
          cleanPerHour: garageConfig.cleanPerHour,
          dirtyPerHour: garageConfig.dirtyPerHour,
          heatPerDay: garageConfig.heatPerDay,
          influencePerDay: garageConfig.influencePerDay
        }) : garageConfig;
        const powerStationConfig = context.config.balance.powerStation ? applyPowerStationIncomeModifiers({
          config: context.config.balance.powerStation,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: recyclingCenterConfig.cleanPerHour,
          dirtyPerHour: recyclingCenterConfig.dirtyPerHour,
          heatPerDay: recyclingCenterConfig.heatPerDay,
          influencePerDay: recyclingCenterConfig.influencePerDay
        }) : recyclingCenterConfig;
        return {
          cash: totals.cash + resolvePerTick$1(powerStationConfig.cleanPerHour, ticksPerHour) * incomeMultiplier * modifiers.cleanIncomeMultiplier,
          dirtyCash: totals.dirtyCash + resolvePerTick$1(powerStationConfig.dirtyPerHour, ticksPerHour) * incomeMultiplier * modifiers.dirtyIncomeMultiplier
        };
      },
      { cash: 0, dirtyCash: 0 }
    );
  };
  const addIncome = (incomeByPlayerId, playerId, resourceKey, rawAmount) => {
    var _a;
    const amount = Math.max(0, Number(rawAmount || 0));
    if (!resourceKey || amount <= 0 || !Number.isFinite(amount)) {
      return;
    }
    incomeByPlayerId[playerId] = {
      ...incomeByPlayerId[playerId],
      [resourceKey]: (((_a = incomeByPlayerId[playerId]) == null ? void 0 : _a[resourceKey]) ?? 0) + amount
    };
  };
  const resolvePerTick$1 = (perHour, ticksPerHour) => {
    const amount = Number(perHour || 0);
    return Number.isFinite(amount) && ticksPerHour > 0 ? Math.max(0, amount) / ticksPerHour : 0;
  };
  const extractEffectModifiers = (payload) => {
    const nested = isRecord$2(payload.effectModifiers) ? payload.effectModifiers : null;
    const source = nested ?? payload;
    return {
      incomeMultiplier: getNumericModifier(source, "incomeMultiplier"),
      cleanIncomeMultiplier: getNumericModifier(source, "cleanIncomeMultiplier"),
      dirtyIncomeMultiplier: getNumericModifier(source, "dirtyIncomeMultiplier"),
      influenceMultiplier: getNumericModifier(source, "influenceMultiplier"),
      heatMultiplier: getNumericModifier(source, "heatMultiplier"),
      influencePerDay: getNumericModifier(source, "influencePerDay"),
      heatPerDay: getNumericModifier(source, "heatPerDay"),
      attackMultiplier: getNumericModifier(source, "attackMultiplier"),
      defenseMultiplier: getNumericModifier(source, "defenseMultiplier")
    };
  };
  const getNumericModifier = (source, key) => {
    const value = Number(source[key]);
    return Number.isFinite(value) ? value : void 0;
  };
  const multiplyModifier = (resolved, key, value) => {
    if (value === void 0 || !Number.isFinite(value) || value <= 0) {
      return;
    }
    resolved[key] *= value;
  };
  const addModifier = (resolved, key, value) => {
    if (value === void 0 || !Number.isFinite(value)) {
      return;
    }
    resolved[key] += value;
  };
  const isRecord$2 = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const getOwnedApartmentBlockCount = (state, playerId, config) => getOwnedApartmentBlocks(state, playerId, config).length;
  const resolveApartmentBlockNetworkMultipliers = (count, config) => {
    const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
    return {
      populationProductionMultiplier: Math.min(
        config.network.maxPopulationProductionMultiplier,
        1 + extra * config.network.populationProductionBonusPctPerExtraBlock / 100
      ),
      capacityMultiplier: Math.min(
        config.network.maxCapacityMultiplier,
        1 + extra * config.network.capacityBonusPctPerExtraBlock / 100
      )
    };
  };
  const getApartmentBlockMetadata = (building2) => {
    var _a, _b;
    const raw = isRecord$1((_a = building2.metadata) == null ? void 0 : _a.apartmentBlock) ? (_b = building2.metadata) == null ? void 0 : _b.apartmentBlock : {};
    return {
      storedPopulation: Math.max(0, Number(raw.storedPopulation || 0)),
      lastUpdatedTick: asOptionalTick(raw.lastUpdatedTick),
      lastCapacity: asOptionalNumber(raw.lastCapacity),
      wasFull: Boolean(raw.wasFull)
    };
  };
  const applyApartmentBlockPopulationProduction = (state, config, tickRateMs, powerStationConfig, recruitmentCenterConfig) => {
    let buildingsById = state.buildingsById;
    let changed = false;
    for (const building2 of Object.values(state.buildingsById)) {
      if (building2.buildingTypeId !== config.buildingTypeId || building2.status !== "active" || !building2.ownerPlayerId) {
        continue;
      }
      const metadata = getApartmentBlockMetadata(building2);
      const lastTick = metadata.lastUpdatedTick ?? state.root.tick;
      const elapsedTicks = Math.max(0, state.root.tick - lastTick);
      const ownedCount = getOwnedApartmentBlockCount(state, building2.ownerPlayerId, config);
      const multipliers = resolveApartmentBlockNetworkMultipliers(ownedCount, config);
      const recruitmentBonuses = resolveRecruitmentCenterSupportBonuses({
        state,
        playerId: building2.ownerPlayerId,
        config: recruitmentCenterConfig
      });
      const infrastructureMultiplier = resolvePowerStationInfrastructureMultiplier({
        state,
        playerId: building2.ownerPlayerId,
        config: powerStationConfig,
        tick: state.root.tick,
        target: "apartmentPopulationProduction"
      });
      const recruitmentPopulationMultiplier = 1 + recruitmentBonuses.populationProductionBonusPct / 100;
      const recruitmentCapacityMultiplier = 1 + recruitmentBonuses.apartmentCapacityBonusPct / 100;
      const capacity = Math.max(1, Math.floor(config.baseCapacity * multipliers.capacityMultiplier * recruitmentCapacityMultiplier + 1e-9));
      const currentStored = Math.min(capacity, metadata.storedPopulation);
      const gain = currentStored >= capacity ? 0 : config.populationPerMinute * multipliers.populationProductionMultiplier * recruitmentPopulationMultiplier * infrastructureMultiplier * elapsedTicks * Math.max(1, tickRateMs) / 6e4;
      const nextStored = Math.min(capacity, currentStored + gain);
      const nextMetadata = {
        storedPopulation: nextStored,
        lastUpdatedTick: state.root.tick,
        lastCapacity: capacity,
        wasFull: nextStored >= capacity
      };
      if (Math.abs(nextMetadata.storedPopulation - metadata.storedPopulation) <= Number.EPSILON && nextMetadata.lastUpdatedTick === metadata.lastUpdatedTick && nextMetadata.lastCapacity === metadata.lastCapacity && nextMetadata.wasFull === metadata.wasFull) {
        continue;
      }
      buildingsById = {
        ...buildingsById,
        [building2.id]: {
          ...building2,
          metadata: withApartmentBlockMetadata(building2, nextMetadata),
          version: building2.version + 1
        }
      };
      changed = true;
    }
    return changed ? { ...state, buildingsById } : state;
  };
  const resolveApartmentBlockAction = (input) => {
    if (input.actionId !== input.apartmentConfig.collectPopulation.actionId) {
      return null;
    }
    const metadata = getApartmentBlockMetadata(input.building);
    const collected = Math.max(0, Math.floor(metadata.storedPopulation));
    const remaining = Math.max(0, metadata.storedPopulation - collected);
    const nextMetadata = {
      ...metadata,
      storedPopulation: remaining,
      lastUpdatedTick: input.state.root.tick,
      wasFull: false
    };
    return {
      balances: {
        ...input.balances,
        "gang-members": Math.max(0, Number(input.balances["gang-members"] || 0) + collected)
      },
      buildingMetadata: withApartmentBlockMetadata(input.building, nextMetadata),
      heatGain: 0,
      influenceChange: 0,
      inputCost: {},
      outputGain: {
        population: collected,
        "gang-members": collected
      },
      reportText: `Vybral jsi ${collected} nových členů gangu z Bytového bloku.`,
      apartmentResult: {
        type: "collect",
        collectedPopulation: collected,
        remainingStoredPopulation: remaining
      }
    };
  };
  const validateApartmentBlockAction = (input) => {
    const config = input.apartmentConfig;
    if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.actionId !== config.collectPopulation.actionId) {
      return null;
    }
    if (Math.floor(getApartmentBlockMetadata(input.building).storedPopulation) <= 0) {
      return "apartment_block_no_population";
    }
    return null;
  };
  const getOwnedApartmentBlocks = (state, playerId, config) => Object.values(state.buildingsById).filter(
    (building2) => building2.buildingTypeId === config.buildingTypeId && building2.ownerPlayerId === playerId && building2.status === "active"
  );
  const withApartmentBlockMetadata = (building2, apartmentBlock) => ({
    ...building2.metadata ?? {},
    apartmentBlock
  });
  const asOptionalTick = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : void 0;
  };
  const asOptionalNumber = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : void 0;
  };
  const isRecord$1 = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const DAY_MS = 24 * 60 * 60 * 1e3;
  const collectIncome = (state, context) => {
    const incomeByPlayerId = calculateIncomeByPlayerId(state, context);
    if (!context && Object.keys(incomeByPlayerId).length === 0) {
      return state;
    }
    let changed = false;
    let nextResourceStatesById = state.resourceStatesById;
    for (const [playerId, incomeBalances] of Object.entries(incomeByPlayerId)) {
      const player = state.playersById[playerId];
      if (!player) {
        continue;
      }
      const currentResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState$4(player, state.root.tick);
      const nextBalances = {
        ...currentResourceState.balances
      };
      for (const [resourceKey, amount] of Object.entries(incomeBalances)) {
        nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) + amount);
      }
      nextResourceStatesById = {
        ...nextResourceStatesById,
        [currentResourceState.id]: {
          ...currentResourceState,
          balances: nextBalances,
          lastUpdatedTick: state.root.tick,
          version: currentResourceState.version + (state.resourceStatesById[currentResourceState.id] ? 1 : 0)
        }
      };
      changed = true;
    }
    const districtPressureResult = context ? applyFixedBuildingPassivePressure(state, context) : {
      changed: false,
      districtsById: state.districtsById
    };
    changed = changed || districtPressureResult.changed;
    const incomeState = changed ? {
      ...state,
      resourceStatesById: nextResourceStatesById,
      districtsById: districtPressureResult.districtsById
    } : state;
    const casinoAuditState = (context == null ? void 0 : context.config.balance.casino) ? applyCasinoAuditChecks(incomeState, context.config.balance.casino, context.config.tickRateMs) : incomeState;
    const exchangeAuditState = (context == null ? void 0 : context.config.balance.exchangeOffice) ? applyExchangeOfficeAuditChecks(casinoAuditState, context.config.balance.exchangeOffice, context.config.tickRateMs) : casinoAuditState;
    const arcadeAuditState = (context == null ? void 0 : context.config.balance.arcade) ? applyArcadeAuditChecks(exchangeAuditState, context.config.balance.arcade, context.config.tickRateMs) : exchangeAuditState;
    const apartmentState = (context == null ? void 0 : context.config.balance.apartmentBlock) ? applyApartmentBlockPopulationProduction(arcadeAuditState, context.config.balance.apartmentBlock, context.config.tickRateMs, context.config.balance.powerStation, context.config.balance.recruitmentCenter) : arcadeAuditState;
    const stripClubRumorState = (context == null ? void 0 : context.config.balance.stripClub) ? applyStripClubPassiveRumors(apartmentState, context.config.balance.stripClub, context.config.tickRateMs) : apartmentState;
    const restaurantRumorState = (context == null ? void 0 : context.config.balance.restaurant) ? applyRestaurantPassiveRumors(stripClubRumorState, context.config.balance.restaurant, context.config.tickRateMs) : stripClubRumorState;
    return (context == null ? void 0 : context.config.balance.convenienceStore) ? applyConvenienceStorePassiveRumors(restaurantRumorState, context.config.balance.convenienceStore, context.config.tickRateMs, context.config.balance.restaurant) : restaurantRumorState;
  };
  const createPlayerResourceState$4 = (player, tick) => ({
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: player.id,
    balances: {},
    incomeModifiers: {},
    lastUpdatedTick: tick,
    version: 1
  });
  const applyFixedBuildingPassivePressure = (state, context) => {
    if (!context.config.balance.fixedBuildings) {
      return {
        changed: false,
        districtsById: state.districtsById
      };
    }
    const ticksPerDay = DAY_MS / Math.max(1, context.config.tickRateMs);
    let changed = false;
    let nextDistrictsById = state.districtsById;
    for (const district of Object.values(state.districtsById)) {
      if (!district.ownerPlayerId || district.status === "destroyed") {
        continue;
      }
      const activeBuildings = getActiveFixedBuildingConfigsForDistrict(state, district, context);
      const modifiers = resolveActiveDistrictEffectModifiers(state, district.id);
      const baseHeatPerDay = activeBuildings.reduce((total, { building: building2, config }) => {
        const casinoConfig = context.config.balance.casino ? applyCasinoIncomeModifiers({
          config: context.config.balance.casino,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: config.cleanPerHour,
          dirtyPerHour: config.dirtyPerHour,
          heatPerDay: config.heatPerDay,
          influencePerDay: config.influencePerDay
        }) : config;
        const activeConfig = context.config.balance.exchangeOffice ? applyExchangeOfficeIncomeModifiers({
          config: context.config.balance.exchangeOffice,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: casinoConfig.cleanPerHour,
          dirtyPerHour: casinoConfig.dirtyPerHour,
          heatPerDay: casinoConfig.heatPerDay,
          influencePerDay: casinoConfig.influencePerDay
        }) : casinoConfig;
        const finalConfig = context.config.balance.arcade ? applyArcadeIncomeModifiers({
          config: context.config.balance.arcade,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: activeConfig.cleanPerHour,
          dirtyPerHour: activeConfig.dirtyPerHour,
          heatPerDay: activeConfig.heatPerDay,
          influencePerDay: activeConfig.influencePerDay
        }) : activeConfig;
        const warehouseConfig = context.config.balance.warehouse ? applyWarehouseIncomeModifiers({
          config: context.config.balance.warehouse,
          state,
          building: building2,
          cleanPerHour: finalConfig.cleanPerHour,
          dirtyPerHour: finalConfig.dirtyPerHour,
          heatPerDay: finalConfig.heatPerDay,
          influencePerDay: finalConfig.influencePerDay
        }) : finalConfig;
        const clinicConfig = context.config.balance.clinic ? applyClinicIncomeModifiers({
          config: context.config.balance.clinic,
          state,
          building: building2,
          cleanPerHour: warehouseConfig.cleanPerHour,
          dirtyPerHour: warehouseConfig.dirtyPerHour,
          heatPerDay: warehouseConfig.heatPerDay,
          influencePerDay: warehouseConfig.influencePerDay
        }) : warehouseConfig;
        const stripClubConfig = context.config.balance.stripClub ? applyStripClubIncomeModifiers({
          config: context.config.balance.stripClub,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: clinicConfig.cleanPerHour,
          dirtyPerHour: clinicConfig.dirtyPerHour,
          heatPerDay: clinicConfig.heatPerDay,
          influencePerDay: clinicConfig.influencePerDay
        }) : clinicConfig;
        const restaurantConfig = context.config.balance.restaurant ? applyRestaurantIncomeModifiers({
          config: context.config.balance.restaurant,
          state,
          building: building2,
          cleanPerHour: stripClubConfig.cleanPerHour,
          dirtyPerHour: stripClubConfig.dirtyPerHour,
          heatPerDay: stripClubConfig.heatPerDay,
          influencePerDay: stripClubConfig.influencePerDay
        }) : stripClubConfig;
        const convenienceStoreConfig = context.config.balance.convenienceStore ? applyConvenienceStoreIncomeModifiers({
          config: context.config.balance.convenienceStore,
          state,
          building: building2,
          cleanPerHour: restaurantConfig.cleanPerHour,
          dirtyPerHour: restaurantConfig.dirtyPerHour,
          heatPerDay: restaurantConfig.heatPerDay,
          influencePerDay: restaurantConfig.influencePerDay
        }) : restaurantConfig;
        const recruitmentCenterConfig = context.config.balance.recruitmentCenter ? applyRecruitmentCenterIncomeModifiers({
          config: context.config.balance.recruitmentCenter,
          state,
          building: building2,
          cleanPerHour: convenienceStoreConfig.cleanPerHour,
          dirtyPerHour: convenienceStoreConfig.dirtyPerHour,
          heatPerDay: convenienceStoreConfig.heatPerDay,
          influencePerDay: convenienceStoreConfig.influencePerDay
        }) : convenienceStoreConfig;
        const shoppingMallConfig = context.config.balance.shoppingMall ? applyShoppingMallIncomeModifiers({
          config: context.config.balance.shoppingMall,
          state,
          building: building2,
          cleanPerHour: recruitmentCenterConfig.cleanPerHour,
          dirtyPerHour: recruitmentCenterConfig.dirtyPerHour,
          heatPerDay: recruitmentCenterConfig.heatPerDay,
          influencePerDay: recruitmentCenterConfig.influencePerDay
        }) : recruitmentCenterConfig;
        const garageConfig = context.config.balance.garage ? applyGarageIncomeModifiers({
          config: context.config.balance.garage,
          state,
          building: building2,
          cleanPerHour: shoppingMallConfig.cleanPerHour,
          dirtyPerHour: shoppingMallConfig.dirtyPerHour,
          heatPerDay: shoppingMallConfig.heatPerDay,
          influencePerDay: shoppingMallConfig.influencePerDay
        }) : shoppingMallConfig;
        const recyclingCenterConfig = context.config.balance.recyclingCenter ? applyRecyclingCenterIncomeModifiers({
          config: context.config.balance.recyclingCenter,
          state,
          building: building2,
          cleanPerHour: garageConfig.cleanPerHour,
          dirtyPerHour: garageConfig.dirtyPerHour,
          heatPerDay: garageConfig.heatPerDay,
          influencePerDay: garageConfig.influencePerDay
        }) : garageConfig;
        const powerStationConfig = context.config.balance.powerStation ? applyPowerStationIncomeModifiers({
          config: context.config.balance.powerStation,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: recyclingCenterConfig.cleanPerHour,
          dirtyPerHour: recyclingCenterConfig.dirtyPerHour,
          heatPerDay: recyclingCenterConfig.heatPerDay,
          influencePerDay: recyclingCenterConfig.influencePerDay
        }) : recyclingCenterConfig;
        return total + sanitizePerDay(powerStationConfig.heatPerDay);
      }, 0);
      const baseInfluencePerDay = activeBuildings.reduce((total, { building: building2, config }) => {
        const casinoConfig = context.config.balance.casino ? applyCasinoIncomeModifiers({
          config: context.config.balance.casino,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: config.cleanPerHour,
          dirtyPerHour: config.dirtyPerHour,
          heatPerDay: config.heatPerDay,
          influencePerDay: config.influencePerDay
        }) : config;
        const activeConfig = context.config.balance.exchangeOffice ? applyExchangeOfficeIncomeModifiers({
          config: context.config.balance.exchangeOffice,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: casinoConfig.cleanPerHour,
          dirtyPerHour: casinoConfig.dirtyPerHour,
          heatPerDay: casinoConfig.heatPerDay,
          influencePerDay: casinoConfig.influencePerDay
        }) : casinoConfig;
        const finalConfig = context.config.balance.arcade ? applyArcadeIncomeModifiers({
          config: context.config.balance.arcade,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: activeConfig.cleanPerHour,
          dirtyPerHour: activeConfig.dirtyPerHour,
          heatPerDay: activeConfig.heatPerDay,
          influencePerDay: activeConfig.influencePerDay
        }) : activeConfig;
        const warehouseConfig = context.config.balance.warehouse ? applyWarehouseIncomeModifiers({
          config: context.config.balance.warehouse,
          state,
          building: building2,
          cleanPerHour: finalConfig.cleanPerHour,
          dirtyPerHour: finalConfig.dirtyPerHour,
          heatPerDay: finalConfig.heatPerDay,
          influencePerDay: finalConfig.influencePerDay
        }) : finalConfig;
        const clinicConfig = context.config.balance.clinic ? applyClinicIncomeModifiers({
          config: context.config.balance.clinic,
          state,
          building: building2,
          cleanPerHour: warehouseConfig.cleanPerHour,
          dirtyPerHour: warehouseConfig.dirtyPerHour,
          heatPerDay: warehouseConfig.heatPerDay,
          influencePerDay: warehouseConfig.influencePerDay
        }) : warehouseConfig;
        const stripClubConfig = context.config.balance.stripClub ? applyStripClubIncomeModifiers({
          config: context.config.balance.stripClub,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: clinicConfig.cleanPerHour,
          dirtyPerHour: clinicConfig.dirtyPerHour,
          heatPerDay: clinicConfig.heatPerDay,
          influencePerDay: clinicConfig.influencePerDay
        }) : clinicConfig;
        const restaurantConfig = context.config.balance.restaurant ? applyRestaurantIncomeModifiers({
          config: context.config.balance.restaurant,
          state,
          building: building2,
          cleanPerHour: stripClubConfig.cleanPerHour,
          dirtyPerHour: stripClubConfig.dirtyPerHour,
          heatPerDay: stripClubConfig.heatPerDay,
          influencePerDay: stripClubConfig.influencePerDay
        }) : stripClubConfig;
        const convenienceStoreConfig = context.config.balance.convenienceStore ? applyConvenienceStoreIncomeModifiers({
          config: context.config.balance.convenienceStore,
          state,
          building: building2,
          cleanPerHour: restaurantConfig.cleanPerHour,
          dirtyPerHour: restaurantConfig.dirtyPerHour,
          heatPerDay: restaurantConfig.heatPerDay,
          influencePerDay: restaurantConfig.influencePerDay
        }) : restaurantConfig;
        const recruitmentCenterConfig = context.config.balance.recruitmentCenter ? applyRecruitmentCenterIncomeModifiers({
          config: context.config.balance.recruitmentCenter,
          state,
          building: building2,
          cleanPerHour: convenienceStoreConfig.cleanPerHour,
          dirtyPerHour: convenienceStoreConfig.dirtyPerHour,
          heatPerDay: convenienceStoreConfig.heatPerDay,
          influencePerDay: convenienceStoreConfig.influencePerDay
        }) : convenienceStoreConfig;
        const shoppingMallConfig = context.config.balance.shoppingMall ? applyShoppingMallIncomeModifiers({
          config: context.config.balance.shoppingMall,
          state,
          building: building2,
          cleanPerHour: recruitmentCenterConfig.cleanPerHour,
          dirtyPerHour: recruitmentCenterConfig.dirtyPerHour,
          heatPerDay: recruitmentCenterConfig.heatPerDay,
          influencePerDay: recruitmentCenterConfig.influencePerDay
        }) : recruitmentCenterConfig;
        const garageConfig = context.config.balance.garage ? applyGarageIncomeModifiers({
          config: context.config.balance.garage,
          state,
          building: building2,
          cleanPerHour: shoppingMallConfig.cleanPerHour,
          dirtyPerHour: shoppingMallConfig.dirtyPerHour,
          heatPerDay: shoppingMallConfig.heatPerDay,
          influencePerDay: shoppingMallConfig.influencePerDay
        }) : shoppingMallConfig;
        const recyclingCenterConfig = context.config.balance.recyclingCenter ? applyRecyclingCenterIncomeModifiers({
          config: context.config.balance.recyclingCenter,
          state,
          building: building2,
          cleanPerHour: garageConfig.cleanPerHour,
          dirtyPerHour: garageConfig.dirtyPerHour,
          heatPerDay: garageConfig.heatPerDay,
          influencePerDay: garageConfig.influencePerDay
        }) : garageConfig;
        const powerStationConfig = context.config.balance.powerStation ? applyPowerStationIncomeModifiers({
          config: context.config.balance.powerStation,
          state,
          building: building2,
          tick: state.root.tick,
          cleanPerHour: recyclingCenterConfig.cleanPerHour,
          dirtyPerHour: recyclingCenterConfig.dirtyPerHour,
          heatPerDay: recyclingCenterConfig.heatPerDay,
          influencePerDay: recyclingCenterConfig.influencePerDay
        }) : recyclingCenterConfig;
        return total + sanitizePerDay(powerStationConfig.influencePerDay);
      }, 0);
      const heatPerDay = baseHeatPerDay * modifiers.heatMultiplier + modifiers.heatPerDay;
      const influencePerDay = baseInfluencePerDay * modifiers.influenceMultiplier + modifiers.influencePerDay;
      const heatDelta = resolvePerTick(heatPerDay, ticksPerDay);
      const influenceDelta = resolvePerTick(influencePerDay, ticksPerDay);
      if (Math.abs(heatDelta) <= Number.EPSILON && Math.abs(influenceDelta) <= Number.EPSILON) {
        continue;
      }
      const nextHeat = Math.max(0, Number(district.heat || 0) + heatDelta);
      const nextInfluence = Math.max(0, Number(district.influence || 0) + influenceDelta);
      nextDistrictsById = {
        ...nextDistrictsById,
        [district.id]: {
          ...district,
          heat: nextHeat,
          influence: nextInfluence,
          version: district.version + 1
        }
      };
      changed = true;
    }
    return {
      changed,
      districtsById: nextDistrictsById
    };
  };
  const sanitizePerDay = (value) => {
    const amount = Number(value || 0);
    return Number.isFinite(amount) ? amount : 0;
  };
  const resolvePerTick = (perDay, ticksPerDay) => Number.isFinite(perDay) && ticksPerDay > 0 ? perDay / ticksPerDay : 0;
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
    policeRaidTriggered: "police-raid-triggered",
    notificationCreated: "notification-created"
  };
  const RAID_PRESSURE_THRESHOLD = 100;
  const RAID_PENDING_FLAG = "raid:pending";
  const triggerRaid = (state, context) => {
    let changed = false;
    let nextPoliceStatesById = state.policeStatesById;
    const events = [];
    const raidIntensityMultiplier = Math.max(0, Number((context == null ? void 0 : context.config.balance.raidIntensityMultiplier) ?? 1));
    const threshold = Math.max(1, Math.floor(RAID_PRESSURE_THRESHOLD / Math.max(0.01, raidIntensityMultiplier)));
    for (const policeState of Object.values(state.policeStatesById)) {
      if (policeState.heat < threshold || policeState.activeFlags.includes(RAID_PENDING_FLAG)) {
        continue;
      }
      const raidResult = createPendingRaidResult(state, policeState);
      nextPoliceStatesById = {
        ...nextPoliceStatesById,
        [policeState.id]: {
          ...policeState,
          wantedLevel: Math.max(policeState.wantedLevel, 5),
          activeFlags: [...policeState.activeFlags, RAID_PENDING_FLAG],
          version: policeState.version + 1
        }
      };
      changed = true;
      events.push(
        createEvent(CORE_EVENT_TYPES.policeRaidTriggered, {
          playerId: policeState.ownerPlayerId,
          policeStateId: policeState.id,
          heat: policeState.heat,
          threshold,
          raidResult,
          cashSeized: raidResult.cashSeized,
          resourcesSeized: raidResult.resourcesSeized,
          gangMembersLost: raidResult.gangMembersLost,
          districtLockdownMinutes: raidResult.districtLockdownMinutes,
          heatReduced: raidResult.heatReduced
        })
      );
    }
    return {
      nextState: changed ? {
        ...state,
        policeStatesById: nextPoliceStatesById
      } : state,
      events
    };
  };
  const createPendingRaidResult = (state, policeState) => {
    var _a;
    const player = state.playersById[policeState.ownerPlayerId];
    const balances = player ? ((_a = state.resourceStatesById[player.resourceStateId]) == null ? void 0 : _a.balances) ?? {} : {};
    const cashSeized = {
      cash: Math.floor(Math.max(0, Number(balances.cash ?? 0)) * 0.05),
      "dirty-cash": Math.floor(Math.max(0, Number(balances["dirty-cash"] ?? 0)) * 0.12)
    };
    const resourcesSeized = Object.fromEntries(
      Object.entries(balances).filter(([key]) => key !== "cash" && key !== "dirty-cash" && key !== "gang-members").map(([key, value]) => [key, Math.floor(Math.max(0, Number(value ?? 0)) * 0.08)]).filter(([, value]) => Number(value) > 0)
    );
    const wantedPressure = Math.max(1, policeState.wantedLevel);
    return {
      cashSeized,
      resourcesSeized,
      gangMembersLost: Math.floor(Math.max(0, Number(balances["gang-members"] ?? 0)) * 0.03),
      districtLockdownMinutes: Math.min(120, 15 + wantedPressure * 5),
      heatReduced: Math.min(policeState.heat, Math.max(10, Math.floor(policeState.heat * 0.2)))
    };
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
    for (const building2 of Object.values(state.buildingsById)) {
      const profile = productionBuildings[building2.buildingTypeId];
      if (!profile || building2.status !== "active") {
        continue;
      }
      const resourceStateId = composeEntityId("resource", building2.id);
      const currentState = state.resourceStatesById[resourceStateId] ?? {
        id: resourceStateId,
        ownerType: "building",
        ownerId: building2.id,
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
      const productionTarget = building2.buildingTypeId === "factory" ? "factoryProductionSpeed" : null;
      const infrastructureMultiplier = productionTarget ? resolvePowerStationInfrastructureMultiplier({
        state,
        playerId: building2.ownerPlayerId,
        config: context.config.balance.powerStation,
        tick: state.root.tick,
        target: productionTarget
      }) : 1;
      const producedPerTick = Math.max(
        0,
        Math.floor(profile.amountPerTick * context.config.balance.productionMultiplier * infrastructureMultiplier)
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
    for (const building2 of Object.values(state.buildingsById)) {
      const processingJob = building2.processing;
      if (!processingJob || building2.status !== "active" || processingJob.completesAtTick > state.root.tick) {
        continue;
      }
      const player = state.playersById[building2.ownerPlayerId];
      const recipe = (_b = (_a = context.config.balance.craftBuildings) == null ? void 0 : _a[building2.buildingTypeId]) == null ? void 0 : _b.recipes[processingJob.recipeId];
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
        [building2.id]: {
          ...building2,
          processing: null,
          version: building2.version + 1
        }
      };
      const notification = createProcessingCompletedNotification(
        state.serverInstance.id,
        building2.id,
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
          playerId: building2.ownerPlayerId,
          districtId: building2.districtId,
          buildingId: building2.id,
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
    const cameraPenalty = hasSpyDetectionChance(cameraCount) ? 0.18 * (1 + Math.max(0, Number(input.cameraStrengthBonusPct || 0)) / 100) : 0;
    const alarmPenalty = alarmCount >= 5 ? 0.08 * (1 + Math.max(0, Number(input.alarmStrengthBonusPct || 0)) / 100) : 0;
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
      blocked: LOSS_ORDER.every((weaponId) => Math.max(0, Number(nextLoadout[weaponId] ?? 0)) === 0),
      trapType: "toxic",
      report: "Toxic trap triggered and burned through the attacking loadout."
    };
  };
  const createDistrictControlScores = (state, districts) => {
    var _a;
    const scoresByKey = /* @__PURE__ */ new Map();
    for (const district of districts) {
      if (district.ownerPlayerId) {
        addDistrictScore(scoresByKey, {
          subjectType: "player",
          subjectId: district.ownerPlayerId,
          influence: district.influence
        });
      }
      const allianceId = district.controllerAllianceId ?? (district.ownerPlayerId ? ((_a = state.playersById[district.ownerPlayerId]) == null ? void 0 : _a.allianceId) ?? null : null);
      if (allianceId) {
        addDistrictScore(scoresByKey, {
          subjectType: "alliance",
          subjectId: allianceId,
          influence: district.influence
        });
      }
    }
    return [...scoresByKey.values()].sort(compareVictoryScores);
  };
  const createDurationScores = (state, districts) => createDistrictControlScores(state, districts).map((score) => {
    var _a;
    return {
      ...score,
      score: score.controlledDistricts * 100 + score.influence + (score.subjectType === "alliance" ? Math.max(0, ((_a = state.alliancesById[score.subjectId]) == null ? void 0 : _a.memberIds.length) ?? 0) * 5 : 0)
    };
  }).sort(compareVictoryScores);
  const createVictorySummary = (input) => {
    var _a;
    const controlledDistricts = ((_a = input.winner) == null ? void 0 : _a.controlledDistricts) ?? 0;
    const hasWinner = Boolean(input.winner && controlledDistricts > 0);
    return {
      hasWinner,
      winnerType: hasWinner ? input.winner.subjectType : "none",
      winnerId: hasWinner ? input.winner.subjectId : null,
      reason: input.reason,
      controlledDistricts,
      totalActiveDistricts: input.totalActiveDistricts,
      controlPercent: input.totalActiveDistricts > 0 ? Math.round(controlledDistricts / input.totalActiveDistricts * 1e4) / 100 : 0,
      mode: input.mode
    };
  };
  const createExistingVictorySummary = (state, context) => {
    var _a, _b, _c, _d, _e, _f;
    const payload = ((_a = state.victoryState) == null ? void 0 : _a.progressPayload) ?? {};
    const winnerType = ((_b = state.matchResult) == null ? void 0 : _b.winnerAllianceId) ? "alliance" : ((_c = state.matchResult) == null ? void 0 : _c.winnerPlayerId) ? "player" : "none";
    return {
      hasWinner: winnerType !== "none",
      winnerType,
      winnerId: ((_d = state.matchResult) == null ? void 0 : _d.winnerAllianceId) ?? ((_e = state.matchResult) == null ? void 0 : _e.winnerPlayerId) ?? null,
      reason: String(payload.reason ?? ((_f = state.matchResult) == null ? void 0 : _f.reason) ?? "resolved"),
      controlledDistricts: Number(payload.controlledDistricts ?? payload.controlledDistrictCount ?? 0),
      totalActiveDistricts: Number(payload.totalActiveDistricts ?? payload.totalActiveDistrictCount ?? 0),
      controlPercent: Number(payload.controlPercent ?? 0),
      mode: String(payload.mode ?? context.config.mode)
    };
  };
  const addDistrictScore = (scoresByKey, input) => {
    const key = `${input.subjectType}:${input.subjectId}`;
    const existing = scoresByKey.get(key);
    scoresByKey.set(key, {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      controlledDistricts: ((existing == null ? void 0 : existing.controlledDistricts) ?? 0) + 1,
      influence: ((existing == null ? void 0 : existing.influence) ?? 0) + Math.max(0, Number(input.influence || 0)),
      score: ((existing == null ? void 0 : existing.controlledDistricts) ?? 0) + 1
    });
  };
  const compareVictoryScores = (left, right) => right.score - left.score || right.controlledDistricts - left.controlledDistricts || getVictorySubjectTypeOrder(left) - getVictorySubjectTypeOrder(right) || left.subjectId.localeCompare(right.subjectId);
  const getVictorySubjectTypeOrder = (score) => score.subjectType === "alliance" ? 0 : 1;
  const checkVictory = (state, context) => {
    var _a, _b;
    if (((_a = state.victoryState) == null ? void 0 : _a.status) === "resolved" || state.matchResult) {
      return {
        nextState: state,
        resolved: true,
        summary: createExistingVictorySummary(state, context)
      };
    }
    const activeDistricts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
    const controlScores = createDistrictControlScores(state, activeDistricts);
    const leader = controlScores[0] ?? null;
    const controlVictoryThreshold = Math.min(1, Math.max(0.01, context.config.balance.districtControlVictoryThreshold ?? 1));
    const requiredControlledDistricts = Math.max(1, Math.ceil(activeDistricts.length * controlVictoryThreshold));
    const activeDistrictControlWonByLeader = context.config.mode === "free" && activeDistricts.length > 1 && leader !== null && leader.controlledDistricts >= requiredControlledDistricts;
    const durationTicks = Math.max(1, Math.ceil(context.config.technical.gameDurationMs / Math.max(1, context.config.tickRateMs)));
    const durationExpired = state.root.tick >= durationTicks;
    if (!activeDistrictControlWonByLeader && !durationExpired) {
      return {
        nextState: state,
        resolved: false,
        summary: createVictorySummary({
          mode: context.config.mode,
          reason: "ongoing",
          winner: leader,
          totalActiveDistricts: activeDistricts.length
        })
      };
    }
    const durationScores = createDurationScores(state, activeDistricts);
    const winner = activeDistrictControlWonByLeader ? leader : durationScores[0] ?? null;
    const reason = activeDistrictControlWonByLeader ? `control:${context.config.balance.victoryConditionKey}` : activeDistricts.length === 0 ? "duration:no-active-districts" : `duration:${context.config.balance.victoryConditionKey}`;
    const summary = createVictorySummary({
      mode: context.config.mode,
      reason,
      winner,
      totalActiveDistricts: activeDistricts.length
    });
    const winnerPlayerId = summary.winnerType === "player" ? summary.winnerId : null;
    const winnerAllianceId = summary.winnerType === "alliance" ? summary.winnerId : null;
    const victoryStateId = state.root.victoryStateId ?? `victory:${state.serverInstance.id}`;
    const matchResultId = state.root.matchResultId ?? `match:${state.serverInstance.id}:${state.root.tick}`;
    const endedAt = (/* @__PURE__ */ new Date(0)).toISOString();
    return {
      nextState: {
        ...state,
        serverInstance: {
          ...state.serverInstance,
          status: "ended",
          endedAt,
          version: state.serverInstance.version + 1
        },
        root: {
          ...state.root,
          phase: PRODUCTION_GAME_LIFECYCLE_PHASES.resolved,
          victoryStateId,
          matchResultId,
          version: state.root.version + 1
        },
        victoryState: {
          id: victoryStateId,
          serverInstanceId: state.serverInstance.id,
          status: "resolved",
          victoryType: context.config.balance.victoryConditionKey,
          leaderPlayerId: winnerPlayerId,
          leaderAllianceId: winnerAllianceId,
          progressPayload: {
            ...summary,
            reason,
            controlledDistrictCount: summary.controlledDistricts,
            totalActiveDistrictCount: activeDistricts.length,
            requiredControlledDistricts,
            durationTicks,
            currentTick: state.root.tick
          },
          resolvedAtTick: state.root.tick,
          version: (((_b = state.victoryState) == null ? void 0 : _b.version) ?? 0) + 1
        },
        matchResult: {
          id: matchResultId,
          serverInstanceId: state.serverInstance.id,
          endedAt,
          winnerPlayerId,
          winnerAllianceId,
          ranking: (durationExpired ? durationScores : controlScores).map((score, index) => ({
            subjectType: score.subjectType,
            subjectId: score.subjectId,
            rank: index + 1,
            score: score.score
          })),
          reason
        }
      },
      resolved: true,
      summary
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
    const building2 = state.buildingsById[command.payload.buildingId];
    if (!building2) {
      return [
        {
          code: "building_not_found",
          message: "Target production building does not exist."
        }
      ];
    }
    const district = state.districtsById[command.payload.districtId];
    if (!district || building2.districtId !== district.id) {
      return [
        {
          code: "district_not_found",
          message: "Target district for collection does not exist."
        }
      ];
    }
    if (district.ownerPlayerId !== command.playerId || building2.ownerPlayerId !== command.playerId) {
      return [
        {
          code: "production_not_owned",
          message: "Player does not own the target production building."
        }
      ];
    }
    if (building2.status !== "active") {
      return [
        {
          code: "building_not_active",
          message: "Only active production buildings can be collected."
        }
      ];
    }
    const productionProfile = (_a = context.config.balance.productionBuildings) == null ? void 0 : _a[building2.buildingTypeId];
    if (!productionProfile) {
      return [
        {
          code: "production_not_supported",
          message: "The target building does not support migrated production collection."
        }
      ];
    }
    const resourceState = state.resourceStatesById[composeEntityId("resource", building2.id)];
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
    const building2 = state.buildingsById[command.payload.buildingId];
    if (!building2) {
      return [
        {
          code: "building_not_found",
          message: "Target crafting building does not exist."
        }
      ];
    }
    const district = state.districtsById[command.payload.districtId];
    if (!district || building2.districtId !== district.id) {
      return [
        {
          code: "district_not_found",
          message: "Target district for crafting does not exist."
        }
      ];
    }
    if (district.ownerPlayerId !== command.playerId || building2.ownerPlayerId !== command.playerId) {
      return [
        {
          code: "craft_not_owned",
          message: "Player does not own the target crafting building."
        }
      ];
    }
    if (building2.status !== "active") {
      return [
        {
          code: "building_not_active",
          message: "Only active buildings can process items."
        }
      ];
    }
    const craftProfile = (_a = context.config.balance.craftBuildings) == null ? void 0 : _a[building2.buildingTypeId];
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
    if (building2.processing) {
      const activeRecipe = craftProfile.recipes[building2.processing.recipeId];
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
    const building2 = state.buildingsById[command.payload.buildingId];
    const action2 = (_a = context.config.balance.buildingActions) == null ? void 0 : _a[command.payload.actionId];
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
    if (!building2) {
      errors.push({
        code: "building_not_found",
        message: `Building ${command.payload.buildingId} was not found.`
      });
    }
    if (!action2) {
      errors.push({
        code: "building_action_not_found",
        message: `Building action ${command.payload.actionId} is not configured.`
      });
    }
    if (errors.length > 0 || !player || !district || !building2 || !action2) {
      return errors;
    }
    if (!district.buildingIds.includes(building2.id) || building2.districtId !== district.id) {
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
    if (action2.buildingType !== building2.buildingTypeId) {
      errors.push({
        code: "building_action_type_mismatch",
        message: `Action ${action2.actionId} cannot run on ${building2.buildingTypeId}.`
      });
    }
    if (action2.requiredOwner && (district.ownerPlayerId !== command.playerId || building2.ownerPlayerId !== command.playerId)) {
      errors.push({
        code: "building_action_owner_required",
        message: "Player must own the district and fixed building to run this action."
      });
    }
    if (district.status === "contested" && !action2.allowedIfContested) {
      errors.push({
        code: "building_action_contested",
        message: "This building action cannot run while the district is contested."
      });
    }
    if (building2.status !== "active") {
      errors.push({
        code: "building_not_active",
        message: "Only active fixed buildings can run actions."
      });
    }
    const cooldownUntilTick = Number((building2.actionCooldowns ?? {})[action2.actionId] ?? 0);
    if (cooldownUntilTick > state.root.tick) {
      errors.push({
        code: "building_action_cooldown",
        message: `Building action is cooling down for ${cooldownUntilTick - state.root.tick} more ticks.`
      });
    }
    const balances = ((_b = state.resourceStatesById[player.resourceStateId]) == null ? void 0 : _b.balances) ?? {};
    const missingCosts = Object.entries(action2.inputCost).filter(
      ([resourceKey, requiredAmount]) => Math.max(0, Number(balances[resourceKey] || 0)) < requiredAmount
    );
    if (missingCosts.length > 0) {
      errors.push({
        code: "building_action_insufficient_resources",
        message: `Missing resources: ${missingCosts.map(([key, amount]) => `${amount} ${key}`).join(", ")}.`
      });
    }
    const casinoErrorCode = validateCasinoAction({
      state,
      building: building2,
      actionId: action2.actionId,
      balances,
      casinoConfig: context.config.balance.casino
    });
    if (casinoErrorCode) {
      errors.push({
        code: casinoErrorCode,
        message: "Casino action preconditions are not met."
      });
    }
    const exchangeOfficeErrorCode = validateExchangeOfficeAction({
      state,
      building: building2,
      actionId: action2.actionId,
      balances,
      exchangeConfig: context.config.balance.exchangeOffice
    });
    if (exchangeOfficeErrorCode) {
      errors.push({
        code: exchangeOfficeErrorCode,
        message: "Exchange office action preconditions are not met."
      });
    }
    const arcadeErrorCode = validateArcadeAction({
      state,
      building: building2,
      actionId: action2.actionId,
      balances,
      arcadeConfig: context.config.balance.arcade
    });
    if (arcadeErrorCode) {
      errors.push({
        code: arcadeErrorCode,
        message: "Arcade action preconditions are not met."
      });
    }
    const apartmentBlockErrorCode = validateApartmentBlockAction({
      building: building2,
      actionId: action2.actionId,
      apartmentConfig: context.config.balance.apartmentBlock
    });
    if (apartmentBlockErrorCode) {
      errors.push({
        code: apartmentBlockErrorCode,
        message: "Apartment block action preconditions are not met."
      });
    }
    const clinicErrorCode = validateClinicAction({
      state,
      playerId: player.id,
      actionId: action2.actionId,
      balances,
      clinicConfig: context.config.balance.clinic,
      tickRateMs: context.config.tickRateMs
    });
    if (clinicErrorCode) {
      errors.push({
        code: clinicErrorCode,
        message: "Clinic action preconditions are not met."
      });
    }
    const recyclingCenterErrorCode = validateRecyclingCenterAction({
      state,
      playerId: player.id,
      actionId: action2.actionId,
      balances,
      recyclingCenterConfig: context.config.balance.recyclingCenter,
      tickRateMs: context.config.tickRateMs
    });
    if (recyclingCenterErrorCode) {
      errors.push({
        code: recyclingCenterErrorCode,
        message: "Recycling center action preconditions are not met."
      });
    }
    const stripClubErrorCode = validateStripClubAction({
      state,
      district,
      building: building2,
      actionId: action2.actionId,
      stripClubConfig: context.config.balance.stripClub
    });
    if (stripClubErrorCode) {
      errors.push({
        code: stripClubErrorCode,
        message: "Strip Club action preconditions are not met."
      });
    }
    const powerStationErrorCode = validatePowerStationAction({
      state,
      building: building2,
      actionId: action2.actionId,
      powerStationConfig: context.config.balance.powerStation
    });
    if (powerStationErrorCode) {
      errors.push({
        code: powerStationErrorCode,
        message: "Power station action preconditions are not met."
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
    const building2 = collection[buildingId];
    return building2 ? {
      ...collection,
      [building2.id]: {
        ...building2,
        ownerPlayerId,
        version: building2.version + 1
      }
    } : collection;
  }, state.buildingsById);
  const markDestroyedDistrictBuildings = (state, buildingIds) => buildingIds.reduce((collection, buildingId) => {
    const building2 = collection[buildingId];
    return building2 ? {
      ...collection,
      [building2.id]: {
        ...building2,
        status: "destroyed",
        version: building2.version + 1
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
      outcomeTier: input.outcomeTier,
      districtCaptured: input.districtCaptured,
      districtDestroyed: input.districtDestroyed,
      districtDamaged: input.districtDamaged,
      trapTriggered: input.trapTriggered,
      trapType: input.trapType,
      trapReport: input.trapReport,
      attackerLosses: input.attackerLosses,
      defenderLosses: input.defenderLosses,
      heatGained: input.heatGained,
      reportForAttacker: input.reportForAttacker,
      reportForDefender: input.reportForDefender,
      attackDurationTicks: input.attackDurationTicks,
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
      outcomeTier: input.outcomeTier,
      districtCaptured: input.districtCaptured,
      districtDestroyed: input.districtDestroyed,
      districtDamaged: input.districtDamaged,
      trapTriggered: input.trapTriggered,
      trapType: input.trapType,
      trapReport: input.trapReport,
      attackerLosses: input.attackerLosses,
      defenderLosses: input.defenderLosses,
      heatGained: input.heatGained,
      reportForAttacker: input.reportForAttacker,
      reportForDefender: input.reportForDefender,
      attackDurationTicks: input.attackDurationTicks,
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
  const createDistrictAttackEvents = (input) => {
    const events = [
      createEvent(CORE_EVENT_TYPES.districtAttacked, {
        attackerPlayerId: input.command.playerId,
        districtId: input.targetDistrictId,
        ...input.attackPayload
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: input.attackerReport.id,
        recipientId: input.attackerReport.recipientId,
        category: input.attackerReport.category
      })
    ];
    if (input.defenderReport) {
      events.push(
        createEvent(CORE_EVENT_TYPES.notificationCreated, {
          notificationId: input.defenderReport.id,
          recipientId: input.defenderReport.recipientId,
          category: input.defenderReport.category
        })
      );
    }
    if (input.activeTrapId) {
      events.push(
        createEvent(CORE_EVENT_TYPES.trapTriggered, {
          trapId: input.activeTrapId,
          districtId: input.targetDistrictId,
          attackerPlayerId: input.command.playerId,
          trapType: input.trapType,
          attackerLosses: input.trapLosses,
          report: input.trapReport
        })
      );
    }
    if (input.attackSucceeded) {
      events.push(
        createEvent(CORE_EVENT_TYPES.districtCaptured, {
          attackerPlayerId: input.command.playerId,
          districtId: input.targetDistrictId,
          previousOwnerPlayerId: input.previousOwnerPlayerId
        })
      );
    }
    return events;
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
    const sourceDistrict = command.payload.sourceDistrictId ? state.districtsById[command.payload.sourceDistrictId] : null;
    const activeTrap = Object.values(state.trapsById).find(
      (trap) => trap.districtId === targetDistrict.id && trap.status === "active"
    );
    const trapResolution = activeTrap ? resolveTrap({
      attackLoadout: attacker.attackLoadout,
      trapAttackLosses: ((_a = context.config.balance.conflict) == null ? void 0 : _a.trapAttackLosses) ?? 1
    }) : {
      losses: {},
      nextLoadout: { ...attacker.attackLoadout },
      blocked: false,
      trapType: "toxic",
      report: ""
    };
    const effectiveLoadout = trapResolution.nextLoadout;
    const grenadeCount = effectiveLoadout.grenade ?? 0;
    const bazookaCount = effectiveLoadout.bazooka ?? 0;
    const towerCount = targetDistrict.defenseLoadout["defense-tower"] ?? 0;
    const attackerDistrictModifiers = (sourceDistrict == null ? void 0 : sourceDistrict.ownerPlayerId) === attacker.id ? resolveActiveDistrictEffectModifiers(state, sourceDistrict.id) : createDefaultDistrictEffectModifiers();
    const targetDistrictModifiers = resolveActiveDistrictEffectModifiers(state, targetDistrict.id);
    const attackerRecruitmentBonuses = resolveRecruitmentCenterSupportBonuses({
      state,
      playerId: attacker.id,
      config: context.config.balance.recruitmentCenter
    });
    const defenderRecruitmentBonuses = resolveRecruitmentCenterSupportBonuses({
      state,
      playerId: targetDistrict.ownerPlayerId,
      config: context.config.balance.recruitmentCenter
    });
    const combinedCameraAlarmBonuses = resolveCombinedCameraAlarmBonuses({
      state,
      playerId: targetDistrict.ownerPlayerId,
      recruitmentCenterConfig: context.config.balance.recruitmentCenter,
      powerStationConfig: context.config.balance.powerStation,
      tick: state.root.tick
    });
    const attackStrengthMultiplier = 1 + attackerRecruitmentBonuses.attackWeaponStrengthBonusPct / 100;
    const defenseStrengthMultiplier = 1 + defenderRecruitmentBonuses.defenseItemStrengthBonusPct / 100;
    const baseAttackPower = calculateTotalAttackPower(attacker.attackLoadout, attackStrengthMultiplier);
    const trapAdjustedAttackPower = calculateTotalAttackPower(effectiveLoadout, attackStrengthMultiplier);
    const effectAdjustedAttackPower = trapAdjustedAttackPower * attackerDistrictModifiers.attackMultiplier;
    const defensePower = calculateBaseDefensePower(targetDistrict.defenseLoadout, {
      vest: defenseStrengthMultiplier,
      barricades: defenseStrengthMultiplier,
      "defense-tower": defenseStrengthMultiplier,
      cameras: 1 + combinedCameraAlarmBonuses.cameraStrengthBonusPct / 100,
      alarm: 1 + combinedCameraAlarmBonuses.alarmStrengthBonusPct / 100
    });
    const effectAdjustedDefensePower = defensePower * targetDistrictModifiers.defenseMultiplier;
    const effectiveAttackPower = calculateReducedAttackPowerFromTowers(effectAdjustedAttackPower, towerCount);
    const effectiveDefensePower = calculateEffectiveDefenseAfterGrenades(effectAdjustedDefensePower, grenadeCount);
    const catastropheRoll = deterministicUnitInterval(
      `${state.serverInstance.worldSeed}:attack:catastrophe:${command.playerId}:${targetDistrict.id}:${state.root.tick}:${command.id}`
    );
    const catastropheChance = Math.max(0, Math.min(1, Number(((_b = context.config.balance.conflict) == null ? void 0 : _b.catastropheChance) ?? 0)));
    const districtDestroyed = !trapResolution.blocked && catastropheRoll < catastropheChance;
    const combatResolution = resolveCombat({
      attackLoadoutAfterTrap: effectiveLoadout,
      defenseLoadout: targetDistrict.defenseLoadout,
      trapBlocked: trapResolution.blocked,
      districtDestroyed,
      effectiveAttackPower,
      effectiveDefensePower,
      trapLosses: trapResolution.losses,
      heatGain: ((_c = context.config.balance.conflict) == null ? void 0 : _c.attackHeatGain) ?? 6
    });
    const attackSucceeded = combatResolution.districtCaptured;
    const battleResult = combatResolution.legacyResult;
    const currentCooldownState = state.cooldownStatesById[attacker.cooldownStateId] ?? createPlayerCooldownState$1(attacker.id, attacker.cooldownStateId);
    const attackCooldownKey = `attack:${targetDistrict.id}`;
    const attackDurationTicks = applyGarageCooldownReductionTicks({
      baseTicks: resolveAttackDurationTicks(context),
      state,
      playerId: attacker.id,
      config: context.config.balance.garage,
      category: "attackPreparation"
    });
    const nextPoliceState = increasePlayerPoliceHeat(state, attacker, combatResolution.heatGained, state.root.tick);
    const notificationEntries = createBattleReportNotifications({
      command,
      attackerPlayerId: attacker.id,
      defenderPlayerId: targetDistrict.ownerPlayerId,
      targetDistrict,
      result: battleResult,
      outcomeTier: combatResolution.outcomeTier,
      districtCaptured: attackSucceeded,
      districtDestroyed,
      districtDamaged: combatResolution.districtDamaged,
      trapTriggered: Boolean(activeTrap),
      trapType: activeTrap ? trapResolution.trapType : null,
      trapReport: activeTrap ? trapResolution.report : null,
      attackerLosses: combatResolution.attackerLosses,
      defenderLosses: combatResolution.defenderLosses,
      heatGained: combatResolution.heatGained,
      reportForAttacker: combatResolution.reportForAttacker,
      reportForDefender: combatResolution.reportForDefender,
      attackDurationTicks,
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
          attackLoadout: combatResolution.nextAttackerLoadout,
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
          heat: districtDestroyed ? 0 : Math.max(0, Number(targetDistrict.heat || 0) + combatResolution.heatGained),
          influence: districtDestroyed ? 0 : targetDistrict.influence,
          buildingIds: districtDestroyed ? [] : targetDistrict.buildingIds,
          defenseLoadout: districtDestroyed ? {} : combatResolution.nextDefenseLoadout,
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
            [attackCooldownKey]: state.root.tick + attackDurationTicks
          },
          version: currentCooldownState.version + (state.cooldownStatesById[currentCooldownState.id] ? 1 : 0)
        }
      },
      policeStatesById: {
        ...state.policeStatesById,
        [nextPoliceState.id]: nextPoliceState
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
    const recoveryState = appendSalvagePoolEntries(
      appendSalvagePoolEntries(
        appendRecoveryPoolEntries(
          appendRecoveryPoolEntries(
            nextState,
            attacker.id,
            createRecoveryEntriesFromLosses(
              combatResolution.attackerLosses,
              activeTrap && trapResolution.trapType === "toxic" ? "toxic_trap" : "attack"
            ),
            `${command.id}:attacker`
          ),
          targetDistrict.ownerPlayerId,
          createRecoveryEntriesFromLosses(combatResolution.defenderLosses, "defense"),
          `${command.id}:defender`
        ),
        attacker.id,
        createSalvageEntriesFromLosses(
          combatResolution.attackerLosses,
          activeTrap && trapResolution.trapType === "toxic" ? "toxic_trap" : "attack",
          context.config.balance.recyclingCenter
        ),
        `${command.id}:attacker`
      ),
      targetDistrict.ownerPlayerId,
      createSalvageEntriesFromLosses(combatResolution.defenderLosses, "defense", context.config.balance.recyclingCenter),
      `${command.id}:defender`
    );
    const events = createDistrictAttackEvents({
      command,
      attackerReport,
      defenderReport,
      targetDistrictId: targetDistrict.id,
      previousOwnerPlayerId: targetDistrict.ownerPlayerId,
      activeTrapId: (activeTrap == null ? void 0 : activeTrap.id) ?? null,
      trapType: activeTrap ? trapResolution.trapType : null,
      trapLosses: trapResolution.losses,
      trapReport: activeTrap ? trapResolution.report : null,
      attackSucceeded,
      attackPayload: {
        attackPower: baseAttackPower,
        attackPowerAfterTrap: trapAdjustedAttackPower,
        attackMultiplier: attackerDistrictModifiers.attackMultiplier,
        attackPowerAfterEffects: effectAdjustedAttackPower,
        attackPowerAfterTowers: effectiveAttackPower,
        defensePower,
        defenseMultiplier: targetDistrictModifiers.defenseMultiplier,
        cameraStrengthBonusPct: combinedCameraAlarmBonuses.cameraStrengthBonusPct,
        alarmStrengthBonusPct: combinedCameraAlarmBonuses.alarmStrengthBonusPct,
        recruitmentAttackWeaponStrengthBonusPct: attackerRecruitmentBonuses.attackWeaponStrengthBonusPct,
        recruitmentDefenseItemStrengthBonusPct: defenderRecruitmentBonuses.defenseItemStrengthBonusPct,
        defensePowerAfterEffects: effectAdjustedDefensePower,
        defensePowerAfterGrenades: effectiveDefensePower,
        smgComboBonus: calculateSmgComboBonus(effectiveLoadout),
        grenadeDefenseIgnorePercent: calculateGrenadeDefenseIgnorePercent(grenadeCount),
        towerAttackReductionPercent: calculateTowerAttackReductionPercent(towerCount),
        bazookaTotalDestructionBonusPercent: calculateBazookaTotalDestructionBonusPercent(bazookaCount),
        attackSucceeded,
        outcomeTier: combatResolution.outcomeTier,
        districtDestroyed,
        districtCaptured: combatResolution.districtCaptured,
        districtDamaged: combatResolution.districtDamaged,
        catastropheRoll,
        trapTriggered: Boolean(activeTrap),
        trapType: activeTrap ? trapResolution.trapType : null,
        attackerLosses: combatResolution.attackerLosses,
        defenderLosses: combatResolution.defenderLosses,
        heatGained: combatResolution.heatGained,
        attackDurationTicks,
        attackDurationMs: attackDurationTicks * context.config.tickRateMs,
        reportForAttacker: combatResolution.reportForAttacker,
        reportForDefender: combatResolution.reportForDefender
      }
    });
    return {
      nextState: recoveryState,
      events,
      errors: []
    };
  };
  const placeBuilding = (state, command, context) => {
    var _a;
    const buildingId = composeEntityId("building", command.id);
    const district = state.districtsById[command.payload.districtId];
    const productionProfile = (_a = context.config.balance.productionBuildings) == null ? void 0 : _a[command.payload.buildingTypeId];
    const building2 = {
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
    const resourceState = productionProfile ? createBuildingProductionResourceState(building2, productionProfile.resourceKey, state.root.tick) : null;
    return {
      building: building2,
      nextState: {
        ...state,
        districtsById: {
          ...state.districtsById,
          [district.id]: {
            ...district,
            buildingIds: [...district.buildingIds, building2.id],
            version: district.version + 1
          }
        },
        buildingsById: {
          ...state.buildingsById,
          [building2.id]: building2
        },
        resourceStatesById: resourceState ? {
          ...state.resourceStatesById,
          [resourceState.id]: resourceState
        } : state.resourceStatesById
      }
    };
  };
  const createBuildingProductionResourceState = (building2, resourceKey, tick) => ({
    id: composeEntityId("resource", building2.id),
    ownerType: "building",
    ownerId: building2.id,
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
    const { nextState, building: building2 } = placeBuilding(state, command, context);
    return {
      nextState,
      events: [
        createEvent(CORE_EVENT_TYPES.buildingPlaced, {
          buildingId: building2.id,
          districtId: building2.districtId,
          playerId: building2.ownerPlayerId,
          buildingTypeId: building2.buildingTypeId
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
    const building2 = state.buildingsById[command.payload.buildingId];
    const player = state.playersById[command.playerId];
    const productionProfile = (_a = context.config.balance.productionBuildings) == null ? void 0 : _a[building2.buildingTypeId];
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
    const buildingResourceStateId = composeEntityId("resource", building2.id);
    const buildingResourceState = state.resourceStatesById[buildingResourceStateId];
    const collectedAmount = Math.max(
      0,
      Number(((_b = buildingResourceState == null ? void 0 : buildingResourceState.balances) == null ? void 0 : _b[(productionProfile == null ? void 0 : productionProfile.resourceKey) || ""]) || 0)
    );
    const playerResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState$2(player, state.root.tick);
    const warehouseCapacity = context.config.balance.warehouse ? resolveWarehouseStorageCapacity(state, player.id, context.config.balance.warehouse, context.config.balance.powerStation) : null;
    const resourceCapacity = warehouseCapacity ? getWarehouseCapacityForResource(warehouseCapacity, productionProfile.resourceKey) : Number.POSITIVE_INFINITY;
    const currentPlayerAmount = Math.max(0, Number(playerResourceState.balances[productionProfile.resourceKey] || 0));
    const acceptedAmount = Number.isFinite(resourceCapacity) ? Math.max(0, Math.min(collectedAmount, resourceCapacity - currentPlayerAmount)) : collectedAmount;
    const remainingAmount = Math.max(0, collectedAmount - acceptedAmount);
    const nextBuildingResourceState = {
      ...buildingResourceState,
      balances: {
        ...buildingResourceState.balances,
        [productionProfile.resourceKey]: remainingAmount
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
          currentPlayerAmount + acceptedAmount
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
          amount: acceptedAmount
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
      const building2 = state.buildingsById[command.payload.buildingId];
      const craftProfile = (_a = context.config.balance.craftBuildings) == null ? void 0 : _a[building2.buildingTypeId];
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
      const infrastructureMultiplier = building2.buildingTypeId === "armory" ? resolvePowerStationInfrastructureMultiplier({
        state,
        playerId: building2.ownerPlayerId,
        config: context.config.balance.powerStation,
        tick: state.root.tick,
        target: "armoryProductionSpeed"
      }) : 1;
      const baseDurationTicks = Math.max(1, Math.ceil(resolveCraftProcessingDurationTicks(
        recipe.durationTicks,
        context.config.balance.cooldownMultiplier
      ) / infrastructureMultiplier));
      const garageCategory = building2.buildingTypeId === "armory" ? "armoryProductionActions" : building2.buildingTypeId === "factory" ? "factoryProductionActions" : null;
      const durationTicks = garageCategory ? applyGarageCooldownReductionTicks({
        baseTicks: baseDurationTicks,
        state,
        playerId: player.id,
        config: context.config.balance.garage,
        category: garageCategory
      }) : baseDurationTicks;
      const nextBuilding = {
        ...building2,
        processing: {
          recipeId: command.payload.recipeId,
          startedAtTick: state.root.tick,
          completesAtTick: state.root.tick + durationTicks
        },
        version: building2.version + 1
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
      const building2 = state.buildingsById[command.payload.buildingId];
      const recipe = (_b = (_a = context.config.balance.craftBuildings) == null ? void 0 : _a[building2.buildingTypeId]) == null ? void 0 : _b.recipes[command.payload.recipeId];
      return recipe ? [
        createEvent(CORE_EVENT_TYPES.itemProcessingStarted, {
          playerId: command.playerId,
          districtId: command.payload.districtId,
          buildingId: command.payload.buildingId,
          recipeId: command.payload.recipeId,
          completesAtTick: state.root.tick + resolveCraftDurationTicks({
            state,
            playerId: command.playerId,
            building: building2,
            recipeDurationTicks: recipe.durationTicks,
            context
          })
        })
      ] : [];
    })(),
    errors: validateCraft(state, command, context)
  });
  const resolveCraftDurationTicks = (input) => {
    const infrastructureMultiplier = input.building.buildingTypeId === "armory" ? resolvePowerStationInfrastructureMultiplier({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.context.config.balance.powerStation,
      tick: input.state.root.tick,
      target: "armoryProductionSpeed"
    }) : 1;
    const baseDurationTicks = Math.max(1, Math.ceil(resolveCraftProcessingDurationTicks(
      input.recipeDurationTicks,
      input.context.config.balance.cooldownMultiplier
    ) / infrastructureMultiplier));
    const garageCategory = input.building.buildingTypeId === "armory" ? "armoryProductionActions" : input.building.buildingTypeId === "factory" ? "factoryProductionActions" : null;
    return garageCategory ? applyGarageCooldownReductionTicks({
      baseTicks: baseDurationTicks,
      state: input.state,
      playerId: input.playerId,
      config: input.context.config.balance.garage,
      category: garageCategory
    }) : baseDurationTicks;
  };
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
    const combinedCameraAlarmBonuses = resolveCombinedCameraAlarmBonuses({
      state,
      playerId: targetDistrict.ownerPlayerId,
      recruitmentCenterConfig: context.config.balance.recruitmentCenter,
      powerStationConfig: context.config.balance.powerStation,
      tick: state.root.tick
    });
    const reportResult = resolveSpy({
      worldSeed: state.serverInstance.worldSeed,
      playerId: player.id,
      targetDistrictId: targetDistrict.id,
      tick: state.root.tick,
      defenseLoadout: targetDistrict.defenseLoadout,
      hasActiveTrap: Boolean(activeTrap),
      spyBaseSuccessChance: ((_a = context.config.balance.conflict) == null ? void 0 : _a.spyBaseSuccessChance) ?? 0.72,
      spyTrapRevealChance: ((_b = context.config.balance.conflict) == null ? void 0 : _b.spyTrapRevealChance) ?? 0.22,
      cameraStrengthBonusPct: combinedCameraAlarmBonuses.cameraStrengthBonusPct,
      alarmStrengthBonusPct: combinedCameraAlarmBonuses.alarmStrengthBonusPct
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
    const spyCooldownTicks = applyGarageCooldownReductionTicks({
      baseTicks: ((_c = context.config.balance.conflict) == null ? void 0 : _c.spyCooldownTicks) ?? 2,
      state,
      playerId: player.id,
      config: context.config.balance.garage,
      category: "districtSpy"
    });
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
              [spyCooldownKey]: state.root.tick + spyCooldownTicks
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
    const defenseAdded = DEFENSE_LOADOUT_BY_ACTION_ID[input.actionId] ?? null;
    if (defenseAdded) {
      const label = BUILDING_ACTION_MESSAGE_LABELS[input.actionId] ?? "Building crews";
      return {
        nextDistrict: {
          ...input.district,
          defenseLoadout: addDefenseLoadout(input.district.defenseLoadout, defenseAdded)
        },
        defenseAdded,
        intelRevealedDistrictIds: [],
        intelDetectedDefense: {},
        messages: [
          `${label} reinforced this district.`,
          "The added defense is now part of attack and spy resolution."
        ]
      };
    }
    const intelEffect = INTEL_EFFECT_BY_ACTION_ID[input.actionId] ?? null;
    if (intelEffect) {
      const intelRevealedDistrictIds = getIntelDistrictIds(input.state, input.district, intelEffect.limit);
      const label = BUILDING_ACTION_MESSAGE_LABELS[input.actionId] ?? "Intel";
      return {
        nextDistrict: input.district,
        defenseAdded: {},
        intelRevealedDistrictIds,
        intelDetectedDefense: intelEffect.detectDefense ? Object.fromEntries(
          intelRevealedDistrictIds.map((districtId) => {
            var _a;
            return [
              districtId,
              ((_a = input.state.districtsById[districtId]) == null ? void 0 : _a.defenseLoadout) ?? {}
            ];
          })
        ) : {},
        messages: intelRevealedDistrictIds.length > 0 ? intelRevealedDistrictIds.map((districtId) => `${label} revealed activity around ${districtId}.`) : [`${label} did not find a useful lead.`]
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
  const DEFENSE_LOADOUT_BY_ACTION_ID = {
    armory_fortify: {
      barricades: 2,
      cameras: 1,
      alarm: 1
    },
    court_case_pressure: {
      cameras: 1,
      alarm: 1
    },
    fitness_gang_training: {
      vest: 2
    },
    clinic_recovery_boost: {
      vest: 1,
      barricades: 1
    },
    school_discipline: {
      barricades: 1,
      cameras: 1
    },
    garage_escape_routes: {
      alarm: 1
    },
    warehouse_hidden_storage: {
      barricades: 1,
      cameras: 1
    }
  };
  const INTEL_EFFECT_BY_ACTION_ID = {
    restaurant_street_gossip: { limit: 2, detectDefense: false },
    lobby_club_backroom_deal: { limit: 1, detectDefense: false },
    vip_lounge_private_table: { limit: 1, detectDefense: false },
    airport_fast_manifest: { limit: 1, detectDefense: false },
    convenience_street_info: { limit: 2, detectDefense: false },
    strip_club_compromise: { limit: 1, detectDefense: false },
    smuggling_reduce_trace: { limit: 1, detectDefense: false }
  };
  const BUILDING_ACTION_MESSAGE_LABELS = {
    armory_fortify: "Armory crews",
    court_case_pressure: "Court pressure",
    fitness_gang_training: "Fitness security",
    clinic_recovery_boost: "Clinic recovery teams",
    school_discipline: "School discipline crews",
    garage_escape_routes: "Garage route crews",
    warehouse_hidden_storage: "Warehouse crews",
    restaurant_street_gossip: "Street gossip",
    lobby_club_backroom_deal: "Lobby contacts",
    vip_lounge_private_table: "VIP contacts",
    airport_fast_manifest: "Airport manifest",
    convenience_street_info: "Store gossip",
    strip_club_compromise: "Compromat",
    smuggling_reduce_trace: "Smuggling scouts"
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
    const building2 = state.buildingsById[command.payload.buildingId];
    const action2 = (_a = context.config.balance.buildingActions) == null ? void 0 : _a[command.payload.actionId];
    if (!player || !district || !building2 || !action2) {
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
    let nextBalances = {
      ...currentPlayerResourceState.balances
    };
    const casinoResolution = context.config.balance.casino ? resolveCasinoAction({
      state,
      building: building2,
      action: action2,
      balances: nextBalances,
      casinoConfig: context.config.balance.casino,
      tickRateMs: context.config.tickRateMs,
      commandId: command.id
    }) : null;
    const exchangeOfficeResolution = !casinoResolution && context.config.balance.exchangeOffice ? resolveExchangeOfficeAction({
      state,
      building: building2,
      action: action2,
      balances: nextBalances,
      exchangeConfig: context.config.balance.exchangeOffice,
      tickRateMs: context.config.tickRateMs
    }) : null;
    const arcadeResolution = !casinoResolution && !exchangeOfficeResolution && context.config.balance.arcade ? resolveArcadeAction({
      state,
      building: building2,
      action: action2,
      balances: nextBalances,
      arcadeConfig: context.config.balance.arcade,
      tickRateMs: context.config.tickRateMs
    }) : null;
    const apartmentBlockResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && context.config.balance.apartmentBlock ? resolveApartmentBlockAction({
      state,
      building: building2,
      actionId: action2.actionId,
      balances: nextBalances,
      apartmentConfig: context.config.balance.apartmentBlock
    }) : null;
    const clinicResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && context.config.balance.clinic ? resolveClinicAction({
      state,
      playerId: player.id,
      actionId: action2.actionId,
      balances: nextBalances,
      clinicConfig: context.config.balance.clinic,
      warehouseConfig: context.config.balance.warehouse,
      powerStationConfig: context.config.balance.powerStation,
      tickRateMs: context.config.tickRateMs
    }) : null;
    const recyclingCenterResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && context.config.balance.recyclingCenter ? resolveRecyclingCenterAction({
      state,
      playerId: player.id,
      actionId: action2.actionId,
      balances: nextBalances,
      recyclingCenterConfig: context.config.balance.recyclingCenter,
      warehouseConfig: context.config.balance.warehouse,
      powerStationConfig: context.config.balance.powerStation,
      tickRateMs: context.config.tickRateMs
    }) : null;
    const stripClubResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && context.config.balance.stripClub ? resolveStripClubAction({
      state,
      building: building2,
      action: action2,
      balances: nextBalances,
      stripClubConfig: context.config.balance.stripClub,
      tickRateMs: context.config.tickRateMs,
      commandId: command.id
    }) : null;
    const powerStationResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && context.config.balance.powerStation ? resolvePowerStationAction({
      state,
      building: building2,
      action: action2,
      balances: nextBalances,
      powerStationConfig: context.config.balance.powerStation,
      tickRateMs: context.config.tickRateMs
    }) : null;
    const specialResolution = casinoResolution ?? exchangeOfficeResolution ?? arcadeResolution ?? apartmentBlockResolution ?? clinicResolution ?? recyclingCenterResolution ?? stripClubResolution ?? powerStationResolution;
    const resolvedAction = specialResolution ? {
      ...action2,
      inputCost: specialResolution.inputCost,
      outputGain: specialResolution.outputGain,
      heatGain: specialResolution.heatGain,
      influenceChange: specialResolution.influenceChange,
      effectModifiers: specialResolution.effectModifiers ?? action2.effectModifiers,
      reportText: specialResolution.reportText
    } : action2;
    if (specialResolution) {
      nextBalances = specialResolution.balances;
    } else {
      for (const [resourceKey, amount] of Object.entries(action2.inputCost)) {
        nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) - amount);
      }
      for (const [resourceKey, amount] of Object.entries(action2.outputGain)) {
        if (resourceKey === "population") {
          continue;
        }
        nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) + amount);
      }
    }
    const populationGain = Math.max(0, Math.floor(Number(resolvedAction.outputGain.population || 0)));
    const nextPlayerResourceState = {
      ...currentPlayerResourceState,
      balances: nextBalances,
      lastUpdatedTick: state.root.tick,
      version: currentPlayerResourceState.version + (state.resourceStatesById[player.resourceStateId] ? 1 : 0)
    };
    const cooldownTicks = resolveBuildingActionCooldownTicks({
      action: action2,
      state,
      playerId: player.id,
      buildingTypeId: building2.buildingTypeId,
      context
    });
    const nextBuilding = {
      ...building2,
      metadata: (specialResolution == null ? void 0 : specialResolution.buildingMetadata) ?? building2.metadata,
      actionCooldowns: {
        ...building2.actionCooldowns ?? {},
        [resolvedAction.actionId]: state.root.tick + cooldownTicks
      },
      version: building2.version + 1
    };
    const baseNextDistrict = {
      ...district,
      heat: Math.max(0, Number(district.heat || 0) + resolvedAction.heatGain),
      influence: Math.max(0, Number(district.influence || 0) + resolvedAction.influenceChange),
      version: district.version + 1
    };
    const specialEffect = resolveBuildingActionSpecialEffect({
      state,
      district: baseNextDistrict,
      actionId: resolvedAction.actionId
    });
    const nextDistrict = specialEffect.nextDistrict;
    const nextPlayer = {
      ...player,
      ...populationGain > 0 ? { population: Math.max(0, Number(player.population || 0) + populationGain) } : {},
      ...clinicResolution ? { recoveryPool: clinicResolution.playerRecoveryPool } : {},
      ...recyclingCenterResolution ? { salvagePool: recyclingCenterResolution.playerSalvagePool } : {},
      lastActionAt: command.issuedAt,
      version: player.version + 1
    };
    const currentPoliceState = state.policeStatesById[player.policeStateId] ?? createPlayerPoliceState(player, state.root.tick);
    const nextPoliceState = {
      ...currentPoliceState,
      heat: Math.max(0, Number(currentPoliceState.heat || 0) + resolvedAction.heatGain),
      wantedLevel: resolveWantedLevel(Math.max(0, Number(currentPoliceState.heat || 0) + resolvedAction.heatGain)),
      version: currentPoliceState.version + (state.policeStatesById[player.policeStateId] ? 1 : 0)
    };
    const eventId = composeEntityId("event", `${command.id}:building-action`);
    const notification = createBuildingActionReportNotification({
      command,
      action: resolvedAction,
      districtId: district.id,
      buildingId: building2.id,
      buildingTypeId: building2.buildingTypeId,
      playerId: player.id,
      specialEffect,
      tick: state.root.tick,
      eventId,
      casinoResult: casinoResolution == null ? void 0 : casinoResolution.casinoResult,
      exchangeResult: exchangeOfficeResolution == null ? void 0 : exchangeOfficeResolution.exchangeResult,
      arcadeResult: arcadeResolution == null ? void 0 : arcadeResolution.arcadeResult,
      apartmentResult: apartmentBlockResolution == null ? void 0 : apartmentBlockResolution.apartmentResult,
      clinicResult: clinicResolution == null ? void 0 : clinicResolution.clinicResult,
      recyclingResult: recyclingCenterResolution == null ? void 0 : recyclingCenterResolution.recyclingResult,
      stripClubResult: stripClubResolution == null ? void 0 : stripClubResolution.stripClubResult,
      powerStationResult: powerStationResolution == null ? void 0 : powerStationResolution.powerStationResult
    });
    const nextEffectState = createDistrictBuildingActionEffectState({
      state,
      command,
      districtId: district.id,
      buildingId: building2.id,
      action: resolvedAction,
      context
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
          [building2.id]: nextBuilding
        },
        resourceStatesById: {
          ...state.resourceStatesById,
          [nextPlayerResourceState.id]: nextPlayerResourceState
        },
        policeStatesById: {
          ...state.policeStatesById,
          [nextPoliceState.id]: nextPoliceState
        },
        effectStatesById: nextEffectState ? {
          ...state.effectStatesById,
          [nextEffectState.id]: nextEffectState
        } : state.effectStatesById,
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
          buildingId: building2.id,
          buildingTypeId: building2.buildingTypeId,
          actionId: resolvedAction.actionId,
          outputGain: resolvedAction.outputGain,
          heatGain: resolvedAction.heatGain,
          influenceChange: resolvedAction.influenceChange,
          effectModifiers: resolvedAction.effectModifiers,
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
  const resolveBuildingActionCooldownTicks = (input) => {
    const { action: action2, context } = input;
    const cooldownMs = Math.max(0, Number(action2.cooldownMs || action2.durationMs || 0));
    if (cooldownMs <= 0) {
      return 0;
    }
    const rawTicks = Math.ceil(cooldownMs / Math.max(1, context.config.tickRateMs));
    const baseTicks = Math.max(1, Math.ceil(rawTicks * context.config.balance.cooldownMultiplier));
    const category = resolveGarageCategoryForBuildingAction(input.buildingTypeId, action2.actionId);
    return category ? applyGarageCooldownReductionTicks({
      baseTicks,
      state: input.state,
      playerId: input.playerId,
      config: context.config.balance.garage,
      category
    }) : baseTicks;
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
  const createDistrictBuildingActionEffectState = (input) => {
    const modifiers = input.action.effectModifiers;
    if (!modifiers || input.action.durationMs <= 0) {
      return null;
    }
    const effectStateId = composeEntityId("effect", input.districtId);
    const current = input.state.effectStatesById[effectStateId] ?? {
      id: effectStateId,
      ownerType: "district",
      ownerId: input.districtId,
      effects: [],
      version: 0
    };
    const durationTicks = Math.max(
      1,
      Math.ceil(Math.max(0, input.action.durationMs) / Math.max(1, input.context.config.tickRateMs))
    );
    const activeEffect = {
      effectId: composeEntityId("effect", `${input.command.id}:${input.action.actionId}`),
      effectType: "building_action_effect",
      sourceType: "building",
      sourceId: input.buildingId,
      startedAtTick: input.state.root.tick,
      expiresAtTick: input.state.root.tick + durationTicks,
      stackPolicyKey: input.action.actionId,
      payload: {
        actionId: input.action.actionId,
        label: input.action.label,
        durationMs: input.action.durationMs,
        effectModifiers: {
          ...modifiers
        },
        ...modifiers
      }
    };
    return {
      ...current,
      effects: [
        ...current.effects.filter((effect) => effect.expiresAtTick === null || effect.expiresAtTick > input.state.root.tick),
        activeEffect
      ],
      version: current.version + 1
    };
  };
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
      casinoResult: input.casinoResult,
      exchangeResult: input.exchangeResult,
      arcadeResult: input.arcadeResult,
      apartmentResult: input.apartmentResult,
      clinicResult: input.clinicResult,
      recyclingResult: input.recyclingResult,
      stripClubResult: input.stripClubResult,
      powerStationResult: input.powerStationResult,
      heatGain: input.action.heatGain,
      influenceChange: input.action.influenceChange,
      effectModifiers: input.action.effectModifiers,
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
    const incomeState = collectIncome(advancedState, context);
    const producedState = completeProduction(incomeState, context);
    const processingResult = completeCraftProcessing(producedState, context);
    const policeResult = triggerRaid(processingResult.nextState, context);
    const victoryResult = checkVictory(policeResult.nextState, context);
    return {
      nextState: victoryResult.nextState,
      events: [...processingResult.events, ...policeResult.events]
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
        outcomeTier: asBattleOutcomeTier(payload.outcomeTier),
        districtCaptured: Boolean(payload.districtCaptured),
        districtDestroyed: Boolean(payload.districtDestroyed),
        districtDamaged: Boolean(payload.districtDamaged),
        trapTriggered: Boolean(payload.trapTriggered),
        attackerLosses: asNumberRecord(payload.attackerLosses),
        defenderLosses: asNumberRecord(payload.defenderLosses),
        detectedDefense: asNumberRecord(payload.detectedDefense),
        heatGained: Number(payload.heatGained ?? 0),
        reportForAttacker: String(payload.reportForAttacker ?? ""),
        reportForDefender: String(payload.reportForDefender ?? ""),
        attackDurationTicks: Number(payload.attackDurationTicks ?? 0),
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
        casinoResult: asUnknownRecord(payload.casinoResult),
        exchangeResult: asUnknownRecord(payload.exchangeResult),
        arcadeResult: asUnknownRecord(payload.arcadeResult),
        apartmentResult: asUnknownRecord(payload.apartmentResult),
        clinicResult: asUnknownRecord(payload.clinicResult),
        recyclingResult: asUnknownRecord(payload.recyclingResult),
        stripClubResult: asUnknownRecord(payload.stripClubResult),
        powerStationResult: asUnknownRecord(payload.powerStationResult),
        heatGain: Number(payload.heatGain ?? 0),
        influenceChange: Number(payload.influenceChange ?? 0),
        tick: Number(payload.tick ?? 0),
        createdAt: String(payload.createdAt ?? notification.createdAt),
        eventId: payload.eventId ? String(payload.eventId) : null
      };
    }
    return null;
  };
  const asUnknownRecord = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return void 0;
    }
    return { ...value };
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
  const asBattleOutcomeTier = (value) => {
    if (value === "clean_capture" || value === "costly_capture" || value === "failed_raid" || value === "disaster") {
      return value;
    }
    return "failed_raid";
  };
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
    return input.buildings.map((building2) => {
      const definition = buildingDefinitions[building2.buildingTypeId];
      const actions = createBuildingActionViews({
        actionCatalog: input.actionCatalog,
        building: building2,
        state: input.state,
        stripClubConfig: input.stripClubConfig,
        restaurantConfig: input.restaurantConfig,
        convenienceStoreConfig: input.convenienceStoreConfig,
        shoppingMallConfig: input.shoppingMallConfig,
        powerStationConfig: input.powerStationConfig,
        recruitmentCenterConfig: input.recruitmentCenterConfig,
        garageConfig: input.garageConfig,
        recyclingCenterConfig: input.recyclingCenterConfig,
        district: input.district,
        playerId: input.playerId,
        playerBalances: input.playerBalances,
        tick: input.tick,
        tickRateMs: input.tickRateMs
      });
      const baseLabel = (definition == null ? void 0 : definition.label) ?? formatResourceLabel$1(building2.buildingTypeId);
      const variantName = normalizeBuildingDisplayName(building2.displayName) ?? resolveCatalogVariantName(definition, building2.id);
      return {
        buildingId: building2.id,
        buildingTypeId: building2.buildingTypeId,
        label: baseLabel,
        displayName: variantName ?? baseLabel,
        variantName,
        zone: (definition == null ? void 0 : definition.zone) ?? input.district.zone,
        role: (definition == null ? void 0 : definition.role) ?? "Fixed building",
        info: (definition == null ? void 0 : definition.info) ?? "Fixed district building.",
        stats: createBuildingStats({
          definition,
          state: input.state,
          district: input.district,
          building: building2,
          playerId: input.playerId,
          stripClubConfig: input.stripClubConfig,
          restaurantConfig: input.restaurantConfig,
          convenienceStoreConfig: input.convenienceStoreConfig,
          shoppingMallConfig: input.shoppingMallConfig,
          powerStationConfig: input.powerStationConfig,
          recruitmentCenterConfig: input.recruitmentCenterConfig,
          garageConfig: input.garageConfig,
          recyclingCenterConfig: input.recyclingCenterConfig,
          tick: input.tick,
          tickRateMs: input.tickRateMs
        }),
        specialActions: createSpecialActionViews(definition, actions),
        level: building2.level,
        status: building2.status,
        actionCooldowns: { ...building2.actionCooldowns ?? {} },
        actions
      };
    });
  };
  const createBuildingStats = (input) => {
    const definition = input.definition;
    const stats = definition == null ? void 0 : definition.stats;
    const baseStats = [
      { label: "Clean / h", value: `$${formatNumber((stats == null ? void 0 : stats.cleanPerHour) ?? 0)}` },
      { label: "Dirty / h", value: `$${formatNumber((stats == null ? void 0 : stats.dirtyPerHour) ?? 0)}` },
      { label: "Heat / day", value: formatNumber((stats == null ? void 0 : stats.heatPerDay) ?? 0) },
      { label: "Influence / day", value: formatNumber((stats == null ? void 0 : stats.influencePerDay) ?? 0) },
      { label: "Max level", value: String((stats == null ? void 0 : stats.maxLevel) ?? 1) }
    ];
    if (input.building.buildingTypeId === "shopping_mall" && input.shoppingMallConfig && input.building.ownerPlayerId) {
      const ownedCount2 = getOwnedShoppingMallCount(input.state, input.building.ownerPlayerId, input.shoppingMallConfig);
      const network2 = resolveShoppingMallNetworkMultipliers(ownedCount2, input.shoppingMallConfig);
      const marketBonuses = resolveShoppingMallMarketBonuses(ownedCount2, input.shoppingMallConfig);
      return [
        { label: "Clean / min", value: `$${formatNumber(input.shoppingMallConfig.cleanCashPerMinute * network2.cleanIncomeMultiplier)}` },
        { label: "Dirty / min", value: `$${formatNumber(input.shoppingMallConfig.dirtyCashPerMinute * network2.dirtyIncomeMultiplier)}` },
        { label: "Influence / min", value: formatNumber(input.shoppingMallConfig.influencePerMinute * network2.influenceMultiplier) },
        { label: "Heat / min", value: formatNumber(input.shoppingMallConfig.heatPerMinute * network2.heatMultiplier) },
        { label: "Owned malls", value: `${ownedCount2}/${input.shoppingMallConfig.countOnMap}` },
        { label: "Clean income multiplier", value: `x${formatNumber(network2.cleanIncomeMultiplier)}` },
        { label: "Dirty income multiplier", value: `x${formatNumber(network2.dirtyIncomeMultiplier)}` },
        { label: "Influence multiplier", value: `x${formatNumber(network2.influenceMultiplier)}` },
        { label: "Regular market discount", value: `-${formatNumber(marketBonuses.regularMarketDiscountPct)} %` },
        { label: "Black market discount", value: `-${formatNumber(marketBonuses.blackMarketDiscountPct)} %` },
        { label: "Market fee reduction", value: `-${formatNumber(marketBonuses.marketFeeReductionPct)} %` }
      ];
    }
    if (input.building.buildingTypeId !== "strip_club" || !input.stripClubConfig || !input.building.ownerPlayerId) {
      if (input.building.buildingTypeId !== "power_station" || !input.powerStationConfig || !input.building.ownerPlayerId) {
        if (input.building.buildingTypeId !== "restaurant" || !input.restaurantConfig || !input.building.ownerPlayerId) {
          if (input.building.buildingTypeId !== "convenience_store" || !input.convenienceStoreConfig || !input.building.ownerPlayerId) {
            if (input.building.buildingTypeId !== "recruitment_center" || !input.recruitmentCenterConfig || !input.building.ownerPlayerId) {
              if (input.building.buildingTypeId !== "garage" || !input.garageConfig || !input.building.ownerPlayerId) {
                if (input.building.buildingTypeId !== "recycling_center" || !input.recyclingCenterConfig || !input.building.ownerPlayerId) {
                  return baseStats;
                }
                const recyclingCenterConfig = input.recyclingCenterConfig;
                const ownedCount7 = getOwnedRecyclingCenterCount(input.state, input.building.ownerPlayerId, recyclingCenterConfig);
                const network7 = resolveRecyclingCenterNetworkMultipliers(ownedCount7, recyclingCenterConfig);
                const salvageStats = resolveRecyclingCenterSalvageStats({
                  state: input.state,
                  playerId: input.building.ownerPlayerId,
                  config: recyclingCenterConfig,
                  tickRateMs: input.tickRateMs ?? 5e3
                });
                const poolTotal = salvageStats.freshPool.reduce((total, entry) => total + Math.max(0, Number(entry.amount || 0)), 0);
                const nextExpiry = salvageStats.freshPool.reduce((next, entry) => {
                  const lostAtTick = Number(entry.lostAtTick);
                  if (!Number.isFinite(lostAtTick)) return next;
                  const expiresAtTick = lostAtTick + Math.ceil(recyclingCenterConfig.salvage.poolTtlMinutes * 6e4 / Math.max(1, input.tickRateMs ?? 5e3));
                  const remaining2 = Math.max(0, expiresAtTick - input.tick);
                  return next === null ? remaining2 : Math.min(next, remaining2);
                }, null);
                return [
                  { label: "Clean / min", value: `$${formatNumber(recyclingCenterConfig.cleanCashPerMinute * network7.incomeMultiplier)}` },
                  { label: "Heat / min", value: formatNumber(recyclingCenterConfig.heatPerMinute * network7.heatMultiplier) },
                  { label: "Owned centers", value: `${ownedCount7}/${recyclingCenterConfig.countOnMap}` },
                  { label: "Income multiplier", value: `x${formatNumber(network7.incomeMultiplier)}` },
                  { label: "Salvage rate", value: `${formatNumber(salvageStats.salvageRatePct)} %` },
                  { label: "Salvage pool", value: `${formatNumber(poolTotal)} items` },
                  { label: "Next expiry", value: nextExpiry === null ? "none" : formatTickLabel$1(nextExpiry) },
                  { label: "Action cost", value: `$${formatNumber(recyclingCenterConfig.extractLosses.cleanCashCost)}` },
                  { label: "Population recovery", value: "never returns gang members or population" }
                ];
              }
              const ownedCount6 = getOwnedGarageCount(input.state, input.building.ownerPlayerId, input.garageConfig);
              const network6 = resolveGarageNetworkMultipliers(ownedCount6, input.garageConfig);
              const cooldownStats = resolveGarageCooldownStats({
                state: input.state,
                playerId: input.building.ownerPlayerId,
                config: input.garageConfig
              });
              return [
                { label: "Clean / min", value: `$${formatNumber(input.garageConfig.cleanCashPerMinute * network6.incomeMultiplier)}` },
                { label: "Heat / min", value: formatNumber(input.garageConfig.heatPerMinute * network6.heatMultiplier) },
                { label: "Owned garages", value: `${ownedCount6}/${input.garageConfig.countOnMap}` },
                { label: "Income multiplier", value: `x${formatNumber(network6.incomeMultiplier)}` },
                { label: "Cooldown reduction", value: `-${formatNumber(cooldownStats.cooldownReductionPct)} %` },
                { label: "Full bonus categories", value: formatCategoryList(cooldownStats.fullBonusCategories) },
                { label: "Half bonus categories", value: formatCategoryList(cooldownStats.halfBonusCategories) },
                { label: "No bonus categories", value: formatCategoryList(cooldownStats.excludedCategories) }
              ];
            }
            const ownedCount5 = getOwnedRecruitmentCenterCount(input.state, input.building.ownerPlayerId, input.recruitmentCenterConfig);
            const network5 = resolveRecruitmentCenterNetworkMultipliers(ownedCount5, input.recruitmentCenterConfig);
            const support = resolveRecruitmentCenterSupportBonuses({
              state: input.state,
              playerId: input.building.ownerPlayerId,
              config: input.recruitmentCenterConfig
            });
            return [
              { label: "Clean / min", value: `$${formatNumber(input.recruitmentCenterConfig.cleanCashPerMinute * network5.incomeMultiplier)}` },
              { label: "Heat / min", value: formatNumber(input.recruitmentCenterConfig.heatPerMinute * network5.heatMultiplier) },
              { label: "Owned centers", value: `${ownedCount5}/${input.recruitmentCenterConfig.countOnMap}` },
              { label: "Income multiplier", value: `x${formatNumber(network5.incomeMultiplier)}` },
              { label: "Apartment production bonus", value: `+${formatNumber(support.populationProductionBonusPct)} %` },
              { label: "Apartment capacity bonus", value: `+${formatNumber(support.apartmentCapacityBonusPct)} %` },
              { label: "Attack weapon strength", value: `+${formatNumber(support.attackWeaponStrengthBonusPct)} %` },
              { label: "Defense item strength", value: `+${formatNumber(support.defenseItemStrengthBonusPct)} %` },
              { label: "Camera/alarm combined cap", value: `max +${formatNumber(support.combinedCameraAlarmCapPct)} %` }
            ];
          }
          const ownedCount4 = getOwnedConvenienceStoreCount(input.state, input.building.ownerPlayerId, input.convenienceStoreConfig);
          const network4 = resolveConvenienceStoreNetworkMultipliers(ownedCount4, input.convenienceStoreConfig);
          const rumorStats3 = resolveConvenienceStoreRumorStats({
            state: input.state,
            playerId: input.building.ownerPlayerId,
            config: input.convenienceStoreConfig,
            restaurantConfig: input.restaurantConfig
          });
          const civilNetworkBonus = rumorStats3.civilRumorChanceBonusPct > 0 ? `+${formatNumber(rumorStats3.civilRumorChanceBonusPct)} %` : "inactive";
          return [
            { label: "Clean / min", value: `$${formatNumber(input.convenienceStoreConfig.cleanCashPerMinute * network4.cleanIncomeMultiplier)}` },
            { label: "Dirty / min", value: `$${formatNumber(input.convenienceStoreConfig.dirtyCashPerMinute * network4.dirtyIncomeMultiplier)}` },
            { label: "Influence / min", value: formatNumber(input.convenienceStoreConfig.influencePerMinute * network4.influenceMultiplier) },
            { label: "Heat / min", value: formatNumber(input.convenienceStoreConfig.heatPerMinute * network4.heatMultiplier) },
            { label: "Owned stores", value: `${ownedCount4}/${input.convenienceStoreConfig.countOnMap}` },
            { label: "Clean income multiplier", value: `x${formatNumber(network4.cleanIncomeMultiplier)}` },
            { label: "Dirty income multiplier", value: `x${formatNumber(network4.dirtyIncomeMultiplier)}` },
            { label: "Influence multiplier", value: `x${formatNumber(network4.influenceMultiplier)}` },
            { label: "Rumor multiplier", value: `x${formatNumber(network4.rumorMultiplier)}` },
            { label: "Passive rumor chance", value: `${formatNumber(rumorStats3.passiveRumorChancePct)} %` },
            { label: "Rumor truth chance", value: `${formatNumber(rumorStats3.truthChancePct)} %` },
            { label: "Civil network bonus", value: civilNetworkBonus }
          ];
        }
        const ownedCount3 = getOwnedRestaurantCount(input.state, input.building.ownerPlayerId, input.restaurantConfig);
        const network3 = resolveRestaurantNetworkMultipliers(ownedCount3, input.restaurantConfig);
        const rumorStats2 = resolveRestaurantRumorStats({
          state: input.state,
          playerId: input.building.ownerPlayerId,
          config: input.restaurantConfig
        });
        return [
          { label: "Clean / min", value: `$${formatNumber(input.restaurantConfig.cleanCashPerMinute * network3.incomeMultiplier)}` },
          { label: "Influence / min", value: formatNumber(input.restaurantConfig.influencePerMinute * network3.influenceMultiplier) },
          { label: "Heat / min", value: formatNumber(input.restaurantConfig.heatPerMinute * network3.heatMultiplier) },
          { label: "Owned restaurants", value: `${ownedCount3}/${input.restaurantConfig.countOnMap}` },
          { label: "Income multiplier", value: `x${formatNumber(network3.incomeMultiplier)}` },
          { label: "Influence multiplier", value: `x${formatNumber(network3.influenceMultiplier)}` },
          { label: "Rumor multiplier", value: `x${formatNumber(network3.rumorMultiplier)}` },
          { label: "Passive rumor chance", value: `${formatNumber(rumorStats2.passiveRumorChancePct)} %` },
          { label: "Rumor truth chance", value: `${formatNumber(rumorStats2.truthChancePct)} %` }
        ];
      }
      const ownedCount2 = getOwnedPowerStationCount(input.state, input.building.ownerPlayerId, input.powerStationConfig);
      const network2 = resolvePowerStationNetworkMultipliers(ownedCount2, input.powerStationConfig);
      const metadata2 = getPowerStationMetadata(input.building);
      const infrastructureBonusPct = resolvePowerStationInfrastructureBonusPct({
        state: input.state,
        playerId: input.building.ownerPlayerId,
        config: input.powerStationConfig,
        tick: input.tick
      });
      const remaining = Math.max(0, (metadata2.backupGridSwitchExpiresAtTick ?? 0) - input.tick);
      return [
        { label: "Clean / min", value: `$${formatNumber(input.powerStationConfig.cleanCashPerMinute * network2.incomeMultiplier)}` },
        { label: "Heat / min", value: formatNumber(input.powerStationConfig.heatPerMinute * network2.heatMultiplier) },
        { label: "Owned stations", value: `${ownedCount2}/${input.powerStationConfig.countOnMap}` },
        { label: "Infrastructure bonus", value: `${formatNumber(infrastructureBonusPct)} %` },
        { label: "Station income multiplier", value: `x${formatNumber(network2.incomeMultiplier)}` },
        { label: "Camera bonus", value: `${formatNumber(network2.cameraStrengthBonusPct + (remaining > 0 ? input.powerStationConfig.backupGridSwitch.cameraStrengthBonusPct : 0))} %` },
        { label: "Alarm bonus", value: `${formatNumber(network2.alarmStrengthBonusPct + (remaining > 0 ? input.powerStationConfig.backupGridSwitch.alarmStrengthBonusPct : 0))} %` },
        { label: "Backup grid boost", value: remaining > 0 ? formatTickLabel$1(remaining) : "inactive" }
      ];
    }
    const ownedCount = getOwnedStripClubCount(input.state, input.building.ownerPlayerId, input.stripClubConfig);
    const network = resolveStripClubNetworkMultipliers(ownedCount, input.stripClubConfig);
    const metadata = getStripClubMetadata(input.building);
    const rumorStats = resolveStripClubRumorStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config: input.stripClubConfig,
      vipActive: (metadata.vipLoungeExpiresAtTick ?? 0) > input.tick
    });
    const activeContacts = metadata.contacts.filter((contact) => contact.expiresAtTick === null || contact.expiresAtTick > input.tick).map((contact) => contact.label).join(", ");
    return [
      { label: "Clean / min", value: `$${formatNumber(input.stripClubConfig.cleanCashPerMinute * network.incomeMultiplier)}` },
      { label: "Dirty / min", value: `$${formatNumber(input.stripClubConfig.dirtyCashPerMinute * network.incomeMultiplier)}` },
      { label: "Influence / min", value: formatNumber(input.stripClubConfig.influencePerMinute * network.influenceMultiplier) },
      { label: "Heat / min", value: formatNumber(input.stripClubConfig.heatPerMinute * network.heatMultiplier) },
      { label: "Owned clubs", value: `${ownedCount}/${input.stripClubConfig.countOnMap}` },
      { label: "Income multiplier", value: `x${formatNumber(network.incomeMultiplier)}` },
      { label: "Influence multiplier", value: `x${formatNumber(network.influenceMultiplier)}` },
      { label: "Rumor multiplier", value: `x${formatNumber(network.rumorMultiplier)}` },
      { label: "Passive rumor chance", value: `${formatNumber(rumorStats.passiveRumorChancePct)} %` },
      { label: "Rumor truth chance", value: `${formatNumber(rumorStats.truthChancePct)} %` },
      { label: "Active contacts", value: activeContacts || "none" },
      { label: "Scandal risk", value: `${input.stripClubConfig.privateParty.scandalChancePct} %` }
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
    const commandAction = actions.find((action2) => action2.actionId === specialAction.actionId);
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
  const createBuildingActionViews = (input) => Object.values(input.actionCatalog).filter((action2) => action2.buildingType === input.building.buildingTypeId).map((action2) => {
    const cooldownUntilTick = Math.max(0, Number((input.building.actionCooldowns ?? {})[action2.actionId] || 0));
    const cooldownRemainingTicks = Math.max(0, cooldownUntilTick - input.tick);
    const missingCosts = Object.entries(action2.inputCost).filter(
      ([resourceKey, requiredAmount]) => Math.max(0, Number(input.playerBalances[resourceKey] || 0)) < requiredAmount
    );
    const ownerBlocked = action2.requiredOwner && (input.district.ownerPlayerId !== input.playerId || input.building.ownerPlayerId !== input.playerId);
    const stripClubDisabledReason = resolveStripClubDisabledReason({
      state: input.state,
      district: input.district,
      building: input.building,
      action: action2,
      stripClubConfig: input.stripClubConfig,
      tick: input.tick
    });
    const powerStationDisabledReason = resolvePowerStationDisabledReason({
      state: input.state,
      building: input.building,
      action: action2,
      powerStationConfig: input.powerStationConfig,
      tick: input.tick
    });
    const recyclingCenterDisabledReason = resolveRecyclingCenterDisabledReason({
      state: input.state,
      building: input.building,
      action: action2,
      recyclingCenterConfig: input.recyclingCenterConfig,
      tickRateMs: input.tickRateMs ?? 5e3
    });
    const disabledReason = ownerBlocked ? "Only the district owner can run this building action." : input.building.status !== "active" ? "Only active fixed buildings can run actions." : input.district.status === "contested" && !action2.allowedIfContested ? "This action is blocked while the district is contested." : stripClubDisabledReason ? stripClubDisabledReason : powerStationDisabledReason ? powerStationDisabledReason : recyclingCenterDisabledReason ? recyclingCenterDisabledReason : cooldownRemainingTicks > 0 ? `Cooldown ${formatTickLabel$1(cooldownRemainingTicks)}.` : missingCosts.length > 0 ? `Need ${formatInputSummary$1(Object.fromEntries(missingCosts))}.` : null;
    return {
      actionId: action2.actionId,
      label: action2.label,
      description: action2.description,
      durationMs: action2.durationMs,
      cooldownMs: action2.cooldownMs,
      cooldownRemainingTicks,
      inputCost: { ...action2.inputCost },
      outputGain: { ...action2.outputGain },
      heatGain: action2.heatGain,
      influenceChange: action2.influenceChange,
      reportText: action2.reportText,
      enabled: disabledReason === null,
      disabledReason
    };
  });
  const formatInputSummary$1 = (inputCosts) => Object.entries(inputCosts).map(([resourceKey, amount]) => `${amount} ${formatResourceLabel$1(resourceKey)}`).join(" + ");
  const formatResourceLabel$1 = (resourceKey) => resourceKey.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
  const formatCategoryList = (categories) => categories.length > 0 ? categories.map((category) => GARAGE_CATEGORY_LABELS[category] ?? formatResourceLabel$1(category)).join(", ") : "none";
  const GARAGE_CATEGORY_LABELS = {
    gangMovement: "Gang movement",
    attackPreparation: "Attack preparation",
    districtRobbery: "District robbery",
    equipmentTransfer: "Equipment transfer",
    resourceTransfer: "Resource transfer",
    defenseRepair: "Defense repair",
    defenseRestore: "Defense restore",
    districtSpy: "District spy",
    trapDetection: "Trap detection",
    clinicRecovery: "Clinic recovery",
    factoryProductionActions: "Factory production actions",
    armoryProductionActions: "Armory production actions",
    moneyLaundering: "Money laundering",
    casinoActions: "Casino actions",
    exchangeOfficeActions: "Exchange office actions",
    arcadeLaunderingActions: "Arcade laundering actions",
    vipBoosts: "VIP boosts",
    rumorGeneration: "Rumor generation",
    passiveProduction: "Passive production"
  };
  const formatNumber = (value) => {
    const normalized = Number(value || 0);
    return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
  };
  const formatTickLabel$1 = (tickCount) => `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;
  const resolveStripClubDisabledReason = (input) => {
    const config = input.stripClubConfig;
    if (!config || input.building.buildingTypeId !== config.buildingTypeId) {
      return null;
    }
    const metadata = getStripClubMetadata(input.building);
    if (input.action.actionId === config.vipLounge.actionId && (metadata.vipLoungeExpiresAtTick ?? 0) > input.tick) {
      return `VIP salonek active ${formatTickLabel$1((metadata.vipLoungeExpiresAtTick ?? input.tick) - input.tick)}.`;
    }
    if (input.action.actionId === config.privateParty.actionId && (metadata.privatePartyExpiresAtTick ?? 0) > input.tick) {
      return `Soukromá party active ${formatTickLabel$1((metadata.privatePartyExpiresAtTick ?? input.tick) - input.tick)}.`;
    }
    if (input.action.actionId === config.barWhispers.actionId && Math.max(0, Number(input.district.influence || 0)) < config.barWhispers.influenceCost) {
      return `Need ${config.barWhispers.influenceCost} influence.`;
    }
    return null;
  };
  const resolvePowerStationDisabledReason = (input) => {
    const config = input.powerStationConfig;
    if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.action.actionId !== config.backupGridSwitch.actionId) {
      return null;
    }
    const expiresAtTick = getPowerStationMetadata(input.building).backupGridSwitchExpiresAtTick ?? 0;
    if (expiresAtTick > input.tick) {
      return `Záložní síť active ${formatTickLabel$1(expiresAtTick - input.tick)}.`;
    }
    return null;
  };
  const resolveRecyclingCenterDisabledReason = (input) => {
    const config = input.recyclingCenterConfig;
    if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.action.actionId !== config.extractLosses.actionId) {
      return null;
    }
    const stats = resolveRecyclingCenterSalvageStats({
      state: input.state,
      playerId: input.building.ownerPlayerId,
      config,
      tickRateMs: input.tickRateMs
    });
    if (stats.freshPool.length <= 0) {
      return "Salvage pool is empty.";
    }
    return null;
  };
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
    const filledBuildings = district.buildingIds.map((buildingId) => state.buildingsById[buildingId]).filter((building2) => building2 !== void 0 && building2.status !== "destroyed");
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
        state,
        buildings: filledBuildings,
        buildCatalog: input.buildCatalog,
        actionCatalog: input.buildingActionCatalog,
        stripClubConfig: input.stripClubConfig,
        restaurantConfig: input.restaurantConfig,
        convenienceStoreConfig: input.convenienceStoreConfig,
        shoppingMallConfig: input.shoppingMallConfig,
        powerStationConfig: input.powerStationConfig,
        recruitmentCenterConfig: input.recruitmentCenterConfig,
        garageConfig: input.garageConfig,
        recyclingCenterConfig: input.recyclingCenterConfig,
        district,
        playerId: input.playerId,
        playerBalances,
        tick: state.root.tick,
        tickRateMs: input.tickRateMs
      }),
      attackTargets: isDestroyed ? [] : attackTargets,
      spyTargets: isDestroyed ? [] : spyTargets,
      trap: isDestroyed ? null : trap,
      slots: isDestroyed ? [] : Array.from({ length: district.slotCount }, (_value, slotIndex) => {
        var _a2;
        const buildingId = district.buildingIds[slotIndex];
        const building2 = buildingId ? state.buildingsById[buildingId] : void 0;
        if (building2) {
          const productionProfile = input.productionCatalog[building2.buildingTypeId];
          const craftProfile = input.craftCatalog[building2.buildingTypeId];
          const processingView = createProcessingView(building2, craftProfile, state.root.tick);
          const productionState = productionProfile ? state.resourceStatesById[composeEntityId("resource", building2.id)] : null;
          const storedAmount = productionProfile ? Math.max(0, Number(((_a2 = productionState == null ? void 0 : productionState.balances) == null ? void 0 : _a2[productionProfile.resourceKey]) || 0)) : 0;
          return {
            slotIndex,
            buildingId: building2.id,
            buildingTypeId: building2.buildingTypeId,
            status: building2.status,
            canBuild: false,
            production: productionProfile ? {
              resourceKey: productionProfile.resourceKey,
              resourceLabel: productionProfile.resourceLabel,
              storedAmount,
              storageCap: productionProfile.storageCap,
              amountPerTick: Math.max(0, Math.floor(productionProfile.amountPerTick * input.productionMultiplier * resolveProductionInfrastructureMultiplier({
                state,
                building: building2,
                powerStationConfig: input.powerStationConfig
              }))),
              canCollect: isOwnedByPlayer && building2.ownerPlayerId === input.playerId && building2.status === "active" && storedAmount > 0,
              collectDisabledReason: !isOwnedByPlayer || building2.ownerPlayerId !== input.playerId ? "Only the building owner can collect production here." : building2.status !== "active" ? "Only active buildings can collect production." : storedAmount > 0 ? null : `No ${productionProfile.resourceLabel} ready to collect yet.`
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
                canCraft: isOwnedByPlayer && building2.ownerPlayerId === input.playerId && building2.status === "active" && !processingView && missingInputs.length === 0,
                craftDisabledReason: !isOwnedByPlayer || building2.ownerPlayerId !== input.playerId ? "Only the building owner can process items here." : building2.status !== "active" ? "Only active buildings can process items." : processingView ? `Processing ${processingView.label} completes in ${formatTickLabel(processingView.remainingTicks)}.` : missingInputs.length > 0 ? `Need ${formatInputSummary(Object.fromEntries(missingInputs))}.` : null
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
  const createProcessingView = (building2, craftProfile, tick) => {
    if (!building2.processing) {
      return null;
    }
    const recipe = craftProfile == null ? void 0 : craftProfile.recipes[building2.processing.recipeId];
    if (!recipe) {
      return null;
    }
    return {
      recipeId: building2.processing.recipeId,
      label: recipe.label,
      remainingTicks: Math.max(0, building2.processing.completesAtTick - tick),
      totalTicks: Math.max(1, building2.processing.completesAtTick - building2.processing.startedAtTick),
      outputResourceKey: recipe.outputResourceKey,
      outputResourceLabel: recipe.outputResourceLabel,
      outputAmount: recipe.outputAmount
    };
  };
  const formatTickLabel = (tickCount) => `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;
  const resolveProductionInfrastructureMultiplier = (input) => input.building.buildingTypeId === "factory" ? resolvePowerStationInfrastructureMultiplier({
    state: input.state,
    playerId: input.building.ownerPlayerId,
    config: input.powerStationConfig,
    tick: input.state.root.tick,
    target: "factoryProductionSpeed"
  }) : 1;
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
      filledSlotCount: district.buildingIds.map((buildingId) => state.buildingsById[buildingId]).filter((building2) => building2 !== void 0 && building2.status !== "destroyed").length,
      slotCount: district.slotCount
    };
  });
  const createPlayerView = (state, playerId) => {
    var _a;
    const player = state.playersById[playerId];
    const notifications = state.root.notificationIds.map((notificationId) => state.notificationsById[notificationId]).filter((notification) => (notification == null ? void 0 : notification.recipientId) === playerId);
    const victoryState = state.victoryState;
    const resourceBalances = player ? { ...((_a = state.resourceStatesById[player.resourceStateId]) == null ? void 0 : _a.balances) ?? {} } : {};
    if (player && Number.isFinite(Number(player.population))) {
      resourceBalances.population = Math.max(0, Number(player.population || 0));
    }
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
  const MAX_COMMANDS_PER_PLAYER_PER_TICK = 5;
  const validateCommandDispatchGate = (runtime, command) => {
    if (command.serverInstanceId !== runtime.record.id) {
      return [
        {
          code: "server.instance_mismatch",
          message: "Command serverInstanceId does not match the target server instance."
        }
      ];
    }
    if (command.mode !== runtime.record.mode) {
      return [
        {
          code: "server.mode_mismatch",
          message: "Command mode does not match the target server instance mode."
        }
      ];
    }
    if (runtime.processedCommandIds.has(command.id)) {
      return [
        {
          code: "server.duplicate_command",
          message: "Command id was already processed by this server instance."
        }
      ];
    }
    if (runtime.state.serverInstance.status === "ended" || runtime.state.root.phase === PRODUCTION_GAME_LIFECYCLE_PHASES.resolved) {
      return [
        {
          code: "server.instance_resolved",
          message: "Resolved server instances do not accept player commands."
        }
      ];
    }
    if (runtime.state.root.playerIds.length > runtime.config.balance.maxPlayersPerServer) {
      return [
        {
          code: "server.player_cap_exceeded",
          message: "Server instance player count exceeds the configured maximum."
        }
      ];
    }
    const sessionTtlTicks = Math.max(
      1,
      Math.ceil(runtime.config.technical.sessionTtlMs / Math.max(1, runtime.config.tickRateMs))
    );
    if (runtime.state.root.tick >= sessionTtlTicks) {
      return [
        {
          code: "server.session_expired",
          message: "Server instance session TTL has expired."
        }
      ];
    }
    const currentRateWindow = normalizeCommandRateLimitWindow(runtime);
    const currentCommandCount = currentRateWindow.commandCountsByPlayerId[command.playerId] ?? 0;
    if (currentCommandCount >= MAX_COMMANDS_PER_PLAYER_PER_TICK) {
      return [
        {
          code: "server.rate_limited",
          message: "Player command rate limit exceeded for the current server tick."
        }
      ];
    }
    return [];
  };
  const recordCommandRateLimitUsage = (runtime, command) => {
    const currentRateWindow = normalizeCommandRateLimitWindow(runtime);
    currentRateWindow.commandCountsByPlayerId[command.playerId] = (currentRateWindow.commandCountsByPlayerId[command.playerId] ?? 0) + 1;
  };
  const normalizeCommandRateLimitWindow = (runtime) => {
    if (runtime.commandRateLimitWindow.tick === runtime.state.root.tick) {
      return runtime.commandRateLimitWindow;
    }
    runtime.commandRateLimitWindow = {
      tick: runtime.state.root.tick,
      commandCountsByPlayerId: {}
    };
    return runtime.commandRateLimitWindow;
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
      const gateErrors = validateCommandDispatchGate(runtime, command);
      if (gateErrors.length > 0) {
        void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "warn", "command", "Command rejected before core dispatch.", {
          commandId: command.id,
          commandType: command.type,
          errorCount: gateErrors.length
        });
        return {
          runtime,
          errors: gateErrors
        };
      }
      void runtime.replayLogWriter.writeCommand({
        id: `cmd:${command.id}`,
        instanceId: runtime.record.id,
        command,
        receivedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
        actorId: command.playerId,
        correlationId: command.clientRequestId,
        tickAtReceive: runtime.state.root.tick
      });
      runtime.processedCommandIds.add(command.id);
      recordCommandRateLimitUsage(runtime, command);
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
    shopping_mall: ["Neon Mall", "Iron Market Plaza", "Karina shopping center"],
    restaurant: ["Neon Bite", "Black Plate", "Street Fuel", "Blood & Grill", "Midnight Diner", "Iron Taste", "Shadow Kitchen", "Dirty Spoon", "Vice Kitchen", "Urban Hunger", "Smoke & Meat", "The Last Bite", "Gangster Grill", "Concrete Kitchen", "Dark Appetite", "Night Feast", "The Hungry Syndicate", "Rusty Fork", "Back Alley Bistro", "Sinful Kitchen", "Underground Taste", "Savage Kitchen", "Chrome Diner", "Heat Kitchen", "No Mercy Meals", "Broken Plate", "Elite Hunger"],
    pharmacy: ["Neon Medics", "Pulse Pharmacy", "Black Cross Pharma", "Street Remedy", "NightCare Clinic", "Iron Vein Pharmacy", "QuickFix Med", "Shadow Medics", "Urban Cure", "Last Chance Pharmacy"],
    auto_salon: ["Neon Motors", "Iron Wheels Garage", "Blackline Autos", "Street Kings Motors", "Midnight Drive Showroom", "Chrome Syndicate Cars", "Ghost Ride Autos", "Velocity X Garage"],
    fitness_club: ["Iron District Gym", "Beast Factory", "Street Power Club", "No Mercy Fitness"],
    exchange: ["ZeroSum Vault", "Neon Arbitrage", "Phantom Rates", "Cashflow Mirage", "Obsidian Exchange", "Flux Currency Lab", "DeadDrop Finance", "Parallax Exchange", "Ghost Ledger", "Black Circuit Exchange", "Silver Pulse Desk", "Midnight Convertor"],
    arcade: ["Neon Jackpots", "Lucky Circuit", "Black Reel Club", "Midnight Slots", "Spin Syndicate", "Velvet Jackpot Lounge", "Ghost Spin Arcade"],
    casino: ["Dominion Prime Casino", "High Rollers Sanctum", "Velvet Eclipse Casino", "Neon Crown Palace"],
    power_station: ["Neon Power Grid", "IronVolt Station", "BlackCore Energy", "Pulse Reactor", "Voltage Nexus", "Dark Energy Hub", "GridLock Station", "Quantum Power Plant", "Overcharge Facility", "ThunderCore Station", "Nova Energy Complex", "Static Surge Plant", "Flux Power Systems", "Obsidian Reactor", "HyperGrid Control"],
    warehouse: ["IronVault Storage", "BlackCrate Depot", "Shadow Storage Hub", "CargoCore Warehouse", "Ghost Stockpile", "SteelBox Depot", "NightStorage Facility", "Hidden Goods Warehouse", "VaultLine Storage", "Obsidian Depot", "DeadDrop Warehouse", "Lockdown Storage", "Backroom Stockpile", "SecureHold Facility", "SteelNest Depot", "GridSafe Storage", "NightCrate Complex", "CargoLock Hub", "SilentVault Depot", "IronGate Warehouse", "DarkReserve Storage"],
    factory: ["IronWorks Factory", "BlackSmoke Industries", "RustCore Plant", "SteelPulse Factory", "GrimeWorks Facility", "DarkForge Industrial", "Vortex Manufacturing", "HeavyGear Plant", "SmokeLine Industries", "Obsidian Production", "Dust & Steel Works", "NightShift Factory", "CoreMechanix Plant", "Ashline Industries", "BruteForce Manufacturing", "IronClad Works", "GritFactory Complex", "SteelHive Plant", "ToxicFlow Industries", "ShadowMachina Works", "HyperSteel Production", "GrindCore Factory", "MassDrive Industries", "DirtyWorks Plant", "Overload Manufacturing"],
    armory: ["Iron Arsenal", "BlackForge Armory", "WarCore Factory", "Steel Reaper Works", "Crimson Armory", "Bullet Syndicate", "Deadshot Industries", "Obsidian Weapons Lab", "Vortex Arms Facility", "Nightfall Armory", "RapidFire Complex", "HellTrigger Works", "Ghost Weapon Systems", "Bloodline Arsenal", "Savage Arms Co.", "Zero Mercy Armory", "Titan Forge Weapons", "DarkSteel Industries", "Recoil Factory", "Phantom Arms Lab", "Iron Rain Arsenal"],
    recycling_center: ["SteelLoop Recycling", "BlackCycle Depot", "NeoWaste Recovery", "Iron Reclaim Facility", "ScrapCore Center", "Urban Reforge Plant", "DustLine Recycling", "GhostMetal Recovery"],
    apartment_block: Array.from({ length: 36 }, (_, index) => `Blok ${index + 1}`),
    garage: ["Iron Garage", "Street Wheels Hub", "BlackTorque Garage", "Ghost Garage", "NightRide Workshop", "SteelDrive Garage", "BackAlley Garage", "Velocity Garage", "Shadow Wheels"],
    clinic: ["NightCare Clinic", "BlackCross Medical", "PulseFix Clinic", "StreetMed Center", "Iron Health Unit", "GhostCare Facility", "RapidAid Clinic", "ShadowMed Center", "LastHope Clinic", "Urban Recovery"],
    recruitment_center: ["Iron Recruit Hub", "Street Army Center", "BlackFlag Recruitment", "Shadow Enlistment", "Warborn Center", "Ghost Recruit Station", "Bloodline Recruitment", "Urban Soldiers Hub", "Vortex Recruit Base", "Frontline Enlistment", "No Mercy Recruitment"],
    school: ["Street Academy", "Neon Learning Center", "Urban Knowledge Hub", "IronMind School", "Shadow Education", "Vortex Academy", "CoreSkill Institute", "Future Minds School", "BlackBoard Academy", "City Knowledge Center", "BrainCore School", "NextGen Academy", "StreetWise Institute", "LogicLab School"],
    drug_lab: ["Neon Chem Lab", "BlackDust Factory", "GhostCook Lab", "Shadow Chemistry", "CrystalForge", "NightBatch Lab", "Toxic Synthesis", "DarkMix Facility", "StreetLab X", "PureRush Lab", "SilentCook Lab"],
    smuggling_tunnel: ["Ghost Tunnel", "BlackRoute Passage", "Shadow Transit", "Silent Tunnel Network", "Underground Flow", "DarkPath Tunnel", "Hidden Route X", "Night Tunnel Line", "Smugglers Vein", "Phantom Passage", "DeepRoute Tunnel", "Backline Tunnel", "ZeroTrace Route", "Iron Tunnel"],
    street_dealers: ["Corner Dealers", "Night Sellers", "Ghost Pushers", "Street Hustlers", "Shadow Dealers", "QuickDrop Crew", "BackAlley Sellers", "Neon Push", "Silent Dealers", "FastCash Crew", "Dirty Hands", "Block Hustlers", "Dark Trade Crew", "Urban Pushers", "NoFace Dealers"],
    strip_club: ["Velvet Nights", "Neon Desire", "Midnight Dolls", "Crimson Lounge", "Silk & Sin", "Shadow Seduction", "Dark Angels Club", "Electric Temptation", "Night Velvet", "Obsidian Desire", "RedLight Palace", "Forbidden Lounge", "Lust District", "Golden Sinners", "Vice Lounge"],
    convenience_store: ["QuickStop Market", "NightMart", "Urban MiniShop", "Street Corner Store", "24/7 Neon Shop", "FastBuy Market", "Backstreet Market", "GhostMart", "QuickPick Store", "City MiniMarket", "FlashMart", "Night Supply", "Urban Grab Shop", "RapidBuy Store", "Street Essentials", "MiniCore Market", "InstantShop", "Shadow Mart", "EasyBuy Corner", "Daily Needs Shop"]
  };
  const second = 1e3;
  const minute = 60 * second;
  const hour = 60 * minute;
  const freeActionCooldownMs = 90 * second;
  const out = (key, amount) => ({ [key]: amount });
  const resources = (entries) => ({ ...entries });
  const action = (input) => ({
    actionId: input.actionId,
    label: input.label,
    description: input.description,
    effectSummary: input.effectSummary,
    durationMs: Math.max(0, Math.floor(Number(input.durationMs ?? 0))),
    cooldownMs: Math.max(1e3, Math.floor(Number(input.cooldownMs ?? freeActionCooldownMs))),
    inputCost: { ...input.inputCost ?? {} },
    outputGain: { ...input.outputGain ?? {} },
    heatGain: Math.floor(Number(input.heatGain ?? 0)),
    influenceChange: Number(input.influenceChange ?? 0),
    effectModifiers: input.effectModifiers ? { ...input.effectModifiers } : void 0,
    reportText: input.effectSummary
  });
  const legacyAction = (actionId, label, description, effectSummary, cooldownHours, heatGain, outputGain = {}, influenceChange = 0, inputCost = {}, durationHours = 0) => ({
    actionId,
    label,
    description,
    effectSummary,
    durationMs: Math.max(1e3, durationHours * hour),
    cooldownMs: cooldownHours * hour,
    inputCost,
    outputGain,
    heatGain,
    influenceChange,
    reportText: effectSummary
  });
  const stat = (cleanPerHour, dirtyPerHour, heatPerDay, influencePerDay, maxLevel = 5) => ({
    cleanPerHour,
    dirtyPerHour,
    heatPerDay,
    influencePerDay,
    maxLevel
  });
  const perMinuteStat = (cleanPerMinute, dirtyPerMinute, heatPerDay = 0, influencePerDay = 0, maxLevel = 5) => stat(cleanPerMinute * 60, dirtyPerMinute * 60, heatPerDay, influencePerDay, maxLevel);
  const building = (buildingTypeId, label, zone, role, info, stats, specialActions) => ({
    buildingTypeId,
    label,
    nameVariants: publicBuildingNameVariants[buildingTypeId] ?? [],
    zone,
    role,
    info,
    stats,
    specialActions
  });
  const publicBuildingDefinitions = [
    building("central_bank", "Centrální banka", "downtown", "Finance", "Hlavní finanční uzel pro clean cash a kontrolu kapitálu.", perMinuteStat(26, 1, 3, 32), [
      action({ actionId: "central_bank_reserve_audit", label: "Reserve Audit", description: "Přesměruje část rezerv do tvého účtu.", effectSummary: "+clean cash, +vliv, +heat", heatGain: 5, outputGain: out("cash", 180), influenceChange: 2 })
    ]),
    building("city_hall", "Magistrát", "downtown", "Civic control", "Administrativní centrum pro městské procesy a legální krytí.", perMinuteStat(25, 6, 4, 34), [
      action({ actionId: "city_hall_permit_pressure", label: "Permit Pressure", description: "Protlačí povolení a lokální zakázky.", effectSummary: "+clean cash, +vliv, +heat", heatGain: 4, outputGain: out("cash", 150), influenceChange: 3 })
    ]),
    building("lobby_club", "Lobby klub", "downtown", "Influence", "Diskrétní klub pro kontakty, špinavé finance a politické páky.", perMinuteStat(3, 22, 6, 38), [
      action({ actionId: "lobby_club_backroom_deal", label: "Backroom Deal", description: "Domluví vlivnou dohodu mimo záznam.", effectSummary: "+dirty cash, +vliv, +heat", heatGain: 6, outputGain: out("dirty-cash", 180), influenceChange: 4 })
    ]),
    building("stock_exchange", "Burza", "downtown", "Market", "Volatilní kapitál a rychlé přesuny cashflow.", perMinuteStat(18, 1, 3, 24), [
      action({ actionId: "stock_exchange_market_push", label: "Market Push", description: "Krátký tržní tlak vytáhne clean cash.", effectSummary: "+clean cash, +heat", heatGain: 4, outputGain: out("cash", 140), influenceChange: 1 })
    ]),
    building("court", "Soud", "downtown", "Law", "Právní páka pro tlak na území, obranu a politický vliv.", perMinuteStat(16, 4, 3.2, 32), [
      action({ actionId: "court_case_pressure", label: "Case Pressure", description: "Využije právní tlak pro vliv, krytí a obranu districtu.", effectSummary: "+vliv, +obrana, +clean cash, +heat", heatGain: 3, outputGain: out("cash", 110), influenceChange: 5 })
    ]),
    building("vip_lounge", "VIP salonek", "downtown", "Elite", "Elitní zóna pro high-value kontakty, dirty cash a zákulisní dohody.", perMinuteStat(8, 22, 6, 36), [
      action({ actionId: "vip_lounge_private_table", label: "Private Table", description: "Uzavře soukromý deal s VIP hosty.", effectSummary: "+dirty cash, +vliv, +heat", heatGain: 7, outputGain: out("dirty-cash", 220), influenceChange: 3 })
    ]),
    building("airport", "Letiště", "downtown", "Logistics", "Vzdušný logistický uzel pro rychlý přesun zboží, lidí a informací.", perMinuteStat(14, 2, 4, 20), [
      action({ actionId: "airport_fast_manifest", label: "Fast Manifest", description: "Zrychlí přepravní manifest a vytěží cash, zásoby a stopu o okolí.", effectSummary: "+clean cash, +suroviny, +info, +heat", heatGain: 5, outputGain: resources({ cash: 130, "metal-parts": 2, "tech-core": 1 }), influenceChange: 1 })
    ]),
    building("port", "Přístav", "downtown", "Logistics", "Těžká logistika, kontejnery, materiály a dirty cash přes mořské trasy.", perMinuteStat(26, 8.5, 5, 26), [
      action({ actionId: "port_container_cut", label: "Container Cut", description: "Vybere z kontejnerů užitečné zásoby.", effectSummary: "+dirty cash, +materials, +heat", heatGain: 6, outputGain: resources({ "dirty-cash": 160, "metal-parts": 3 }), influenceChange: 1 })
    ]),
    building("parliament", "Parlament", "downtown", "Power", "Nejvyšší politická páka s extrémním clean income a vlivem.", perMinuteStat(22, 3, 3, 40), [
      action({ actionId: "parliament_policy_window", label: "Policy Window", description: "Otevře krátké politické okno pro zisk vlivu.", effectSummary: "+vliv, +clean cash, +heat", heatGain: 5, outputGain: out("cash", 160), influenceChange: 5 })
    ]),
    building("shopping_mall", "Obchodní centrum", "commercial", "Economy / market / influence / multiplier", "Obchodní centrum generuje peníze, menší dirty cash, vliv a snižuje ceny na marketu. Výlohy svítí, kasy pípají a pod parkovištěm se domlouvají dohody, které nikdy neuvidíš na účtence. Obchodní centrum není jen nákupní zóna. Je to tepna zásobování.", perMinuteStat(95, 22, 0.09 * 60 * 24, 0.24 * 60 * 24, 1), []),
    building("restaurant", "Restaurace", "commercial", "Economy / rumors / influence / city life", "Restaurace generuje čisté peníze, trochu vlivu a městské drby. Žádné akce, žádné složitosti. Jen místo, kde město mluví. Stoly u okna, zadní vchod pro kurýry a kuchyně, kde se slyší víc než na ulici.", perMinuteStat(38, 0, 57.6, 172.8, 1), []),
    building("arcade", "Herna", "commercial", "Economy / dirty cash / laundering / network", "Herna je pouliční cashflow. Blikající automaty, špinavé mince, zadní pokladna a dým z cigaret. Sama o sobě tě nespasí, ale síť heren dokáže krmit gang celou free session.", perMinuteStat(42, 72, 172.8, 259.2, 1), [
      action({ actionId: "night_machines", label: "Noční automaty", description: "Dočasně zvýší clean, dirty, vliv, heat a audit risk Herny. Nestackuje se sama se sebou.", effectSummary: "+clean income, +dirty income, +vliv, +heat, +audit risk na 7 minut", cooldownMs: 16 * minute, durationMs: 7 * minute, effectModifiers: { cleanIncomeMultiplier: 1.35, dirtyIncomeMultiplier: 1.65, influenceMultiplier: 1.15, heatMultiplier: 1.45 } }),
      action({ actionId: "back_cashdesk", label: "Zadní pokladna", description: "Instantně vypere 13 % aktuálního dirty cash hráče přes zadní pokladnu.", effectSummary: "-dirty cash, +clean cash po 15 % poplatku, +heat, +vliv, +audit risk", cooldownMs: 12 * minute, heatGain: 3, influenceChange: 1 })
    ]),
    building("casino", "Kasino", "commercial", "Laundering / high-risk", "Vzácná high-value neonová pračka peněz. Dává extrémní cashflow, dirty cash a vliv, ale rychle zvedá heat a audit risk.", perMinuteStat(140, 260, 648, 1008, 4), [
      action({ actionId: "quiet_backroom", label: "Tichá herna", description: "Instantně vypere 24 % aktuálního dirty cash hráče až do limitu kasina.", effectSummary: "-dirty cash, +clean cash po 9 % poplatku, +heat, +vliv, +audit risk", cooldownMs: 14 * minute, heatGain: 7, influenceChange: 3 }),
      action({ actionId: "vip_night", label: "VIP noc", description: "Dočasně zvýší casino income, vliv, heat a audit risk. Nestackuje se sama se sebou.", effectSummary: "+clean income, +dirty income, +vliv, +heat, +audit risk na 10 minut", cooldownMs: 26 * minute, durationMs: 10 * minute, effectModifiers: { cleanIncomeMultiplier: 1.7, dirtyIncomeMultiplier: 1.55, influenceMultiplier: 1.25, heatMultiplier: 1.6 } }),
      action({ actionId: "bribed_inspector", label: "Podplacený inspektor", description: "Zaplatí inspektora. Úspěch sníží heat a audit risk, selhání zvýší tlak.", effectSummary: "Cena 5500 clean cash, šance selhání 14 %, heat control, audit control", cooldownMs: 32 * minute, durationMs: 12 * minute, inputCost: out("cash", 5500) })
    ]),
    building("auto_salon", "Autosalon", "commercial", "Finance a logistika", "Pere peníze přes drahé zboží a podporuje mobilitu posádek.", perMinuteStat(5, 1, 4, 18), [
      action({ actionId: "auto_salon_collect_sales", label: "Vybrat prodeje", description: "Prodeje aut přidají clean i dirty cash.", effectSummary: "+clean cash, +dirty cash, +heat", heatGain: 1, outputGain: resources({ cash: 260, "dirty-cash": 80 }) }),
      action({ actionId: "auto_salon_prepare_fleet", label: "Připravit flotilu", description: "Flotila zvedne logistiku a income.", effectSummary: "+income, +vliv na 10 minut", durationMs: 10 * minute, influenceChange: 2, effectModifiers: { incomeMultiplier: 1.15 } }),
      action({ actionId: "auto_salon_gray_import", label: "Zakryt špinavý cash", description: "Dirty cash se schová přes autosalon.", effectSummary: "+clean cash, -dirty cash, +heat", heatGain: 2, inputCost: out("dirty-cash", 1100), outputGain: out("cash", 902) })
    ]),
    building("fitness_club", "Fitness Club", "commercial", "Legální front", "Civilní front s dobrým clean příjmem, náborem lidí a bojovou utilitou.", perMinuteStat(4, 0.5, 3.8, 22), [
      action({ actionId: "fitness_collect_fees", label: "Vybrat členské poplatky", description: "Členské poplatky přidají clean cash.", effectSummary: "+clean cash, +heat", heatGain: 1, outputGain: out("cash", 220) }),
      action({ actionId: "fitness_gang_training", label: "Nabrat vyhazovače", description: "Vyhazovači posílí posádku a přinesou základní ochranu.", effectSummary: "+gang members, +obrana, +vliv, +heat", heatGain: 2, outputGain: resources({ "gang-members": 2, vest: 1 }), influenceChange: 2 }),
      action({ actionId: "fitness_low_profile", label: "Držet nízký heat", description: "Nízký profil sníží heat a pasivní policejní stopu.", effectSummary: "-heat, menší heat na 10 minut", durationMs: 10 * minute, heatGain: -3, effectModifiers: { heatMultiplier: 0.85 } })
    ]),
    building("exchange", "Směnárna", "commercial", "Economy / laundering / network", "Směnárna pere menší částky bezpečněji než kasino. Jedna směnárna je služba. Síť směnáren je finanční pavouk přes celé město.", perMinuteStat(70, 95, 230.4, 403.2, 1), [
      action({ actionId: "good_rate", label: "Výhodný kurz", description: "Instantně vypere 16 % aktuálního dirty cash hráče přes síť směnáren.", effectSummary: "-dirty cash, +clean cash po 12 % poplatku, +heat, +vliv, +audit risk", cooldownMs: 11 * minute, heatGain: 4, influenceChange: 1.5 })
    ]),
    building("apartment_block", "Bytový blok", "residential", "Population / gang members", "Bytový blok negeneruje peníze ani heat. Jen lidi. A lidi jsou munice města.", stat(0, 0, 0, 0, 1), [
      action({ actionId: "collect_population", label: "Vybrat obyvatele", description: "Přesune lokálně uložené obyvatele do globální populace hráče a členů gangu.", effectSummary: "+obyvatelé, +gang members, bez heatu a bez peněz", cooldownMs: 0 })
    ]),
    building("recruitment_center", "Rekrutační centrum", "residential", "Support / population support / combat multiplier", "Rekrutační centrum nevyrábí lidi. Dělá z obyvatel použitelný gang a z výbavy skutečnou sílu. Lidi přijdou z bloků. Tady se z nich stává armáda ulice.", perMinuteStat(35, 0, 0.07 * 60 * 24, 0, 1), []),
    building("garage", "Garáž", "residential", "Economy / logistics / cooldown multiplier", "Garáž generuje čistý příjem a snižuje cooldowny logistických, pohybových a přípravných akcí. Motory běží pod plechovou střechou, kufry mizí ve tmě a někdo vždycky ví, kudy projet bez kamer. Garáž není jen místo pro auta. Je to tempo celého gangu.", perMinuteStat(42, 0, 0.06 * 60 * 24, 0, 1), []),
    building("clinic", "Klinika", "residential", "Economy / recovery / support", "Klinika nevyrábí zbraně ani gang. Zachraňuje to, co by jinak město sežralo.", stat(3300, 0, 43.2, 0, 1), [
      action({
        actionId: "stabilization_protocol",
        label: "Stabilizační protokol",
        description: "Za clean cash vrátí část neexpirovaných ztrát z recovery poolu do gangu a skladu.",
        effectSummary: "recovery pool, cena 1200 clean, +1 heat",
        cooldownMs: 18 * minute,
        heatGain: 1,
        inputCost: out("cash", 1200)
      })
    ]),
    building("school", "Škola", "residential", "Training", "Produkuje členy a podporuje disciplínu a chemické zázemí.", perMinuteStat(4.4, 1, 2, 16), [
      action({ actionId: "school_lecture", label: "Trénovat členy", description: "Okamžitě přidá nové členy.", effectSummary: "+gang members, +heat", heatGain: 2, outputGain: out("gang-members", 4), influenceChange: 1 }),
      action({ actionId: "school_discipline", label: "Zvýšit disciplínu", description: "Disciplína zlepší obranu na pár minut.", effectSummary: "+obrana, +defense, +vliv, +heat", durationMs: 8 * minute, heatGain: 2, outputGain: out("vest", 1), influenceChange: 2, effectModifiers: { defenseMultiplier: 1.08 } }),
      action({ actionId: "school_chemistry_course", label: "Budovat vliv", description: "Kurz a kontakty přidají chemii i vliv.", effectSummary: "+chemicals, +vliv, +heat", heatGain: 3, outputGain: out("chemicals", 4), influenceChange: 3 })
    ]),
    building("factory", "Továrna", "industrial", "Production", "Produkční budova pro Metal Parts, Tech Core a Combat Module.", stat(0, 0, 3, 10, 14), [
      legacyAction("produce_metal_parts", "Produce Metal Parts", "Vyrobí kovové díly.", "+metal parts, +heat", 3e-3, 1, out("metal-parts", 5)),
      legacyAction("produce_tech_core", "Produce Tech Core", "Sestaví Tech Core z dílů.", "+tech core, +heat", 5e-3, 2, out("tech-core", 1), 0, out("metal-parts", 2)),
      legacyAction("produce_combat_module", "Produce Combat Module", "Vyrobí Combat Module.", "+combat module, +vliv, +heat", 6e-3, 3, out("combat-module", 1), 1, { "metal-parts": 2, "tech-core": 1 })
    ]),
    building("armory", "Zbrojovka", "industrial", "Weapons", "Vyrábí útočné i obranné vybavení z Metal Parts a Tech Core.", stat(0, 0, 4, 18, 14), [
      legacyAction("armory_craft_weapons", "Craft Weapons", "Vyrobí zbraně ze skladových materiálů.", "+combat module, +heat", 6e-3, 3, out("combat-module", 1), 1, { "metal-parts": 2 }),
      legacyAction("armory_fortify", "Fortify District", "Zvedne obrannou připravenost území.", "+vliv, +heat", 8, 4, {}, 3)
    ]),
    building("warehouse", "Sklad", "industrial", "Economy / storage / logistics", "Sklad drží zásoby města pohromadě. Negeneruje špinavé peníze ani vliv, ale bez skladů se impérium zadusí vlastním materiálem.", stat(2700, 0, 86.4, 0, 4), []),
    building("power_station", "Energetická stanice", "industrial", "Infrastructure / support / defense multiplier", "Energetická stanice nezavádí nový zdroj. Zvedá výkon města, drží infrastrukturu při životě a posiluje bezpečnostní systémy. Když svítí stanice, město dýchá rychleji. Kamery vidí ostřeji. Alarmy řvou dřív.", perMinuteStat(50, 0, 115.2, 0, 1), [
      action({ actionId: "backup_grid_switch", label: "Přepnutí na záložní síť", description: "Na 8 minut zvýší infrastructure bonus, posílí kamery a alarmy a přidá výkon Továrnám a Zbrojovkám. Nestackuje se sama se sebou.", effectSummary: "Cena 1200 clean cash, +12 % infrastructure, +20 % kamery, +20 % alarm, heat +3 na 8 minut", cooldownMs: 22 * minute, durationMs: 8 * minute, inputCost: out("cash", 1200), heatGain: 3 })
    ]),
    building("recycling_center", "Recyklační centrum", "industrial", "Support / salvage / item recovery", "Recyklační centrum nevrací lidi. Vrací železo, zbraně, moduly a všechno, co se dá po boji ještě vytáhnout ze šrotu. Když bitva skončí, někdo počítá mrtvé. Recyklační centrum počítá, co se dá znovu použít.", perMinuteStat(40, 0, 0.08 * 60 * 24, 0, 1), [
      action({ actionId: "extract_losses", label: "Vytěžit ztráty", description: "Vrátí část neexpirovaných itemových ztrát ze salvage poolu. Nikdy nevrací populaci ani členy gangu.", effectSummary: "Cena 900 clean cash, salvage podle sítě Recyklačních center, heat +2", cooldownMs: 16 * minute, inputCost: out("cash", 900), heatGain: 2 })
    ]),
    building("pharmacy", "Lékárna", "commercial", "Production", "Support budova se sloty Chemicals, Biomass a Stim Pack. Vyrobené látky živí Drug Lab a bojové boosty.", stat(0, 0, 3, 8, 14), [
      legacyAction("produce_chemicals", "Produce Chemicals", "Vyrobí základní chemikálie.", "+chemicals, +heat", 3e-3, 1, out("chemicals", 6)),
      legacyAction("produce_biomass", "Produce Biomass", "Vyrobí biomasu pro léky a drogy.", "+biomass, +heat", 3e-3, 1, out("biomass", 4)),
      legacyAction("produce_stim_pack", "Produce Stim Pack", "Převede chemicals a biomass na Stim Pack.", "+stim pack, +vliv, +heat", 4e-3, 2, out("stim-pack", 1), 1, { chemicals: 2, biomass: 1 })
    ]),
    building("drug_lab", "Drug Lab", "park", "Drug production", "Core produkční budova pro Neon Dust, Pulse Shot a Velvet Smoke. Produkce generuje heat a zásoby drog.", stat(0, 0, 6, 20, 14), [
      legacyAction("produce_neon_dust", "Produce Neon Dust", "Syntetizuje Neon Dust.", "+neon dust, +vliv, +heat", 4e-3, 3, out("neon-dust", 2), 1, out("chemicals", 1)),
      legacyAction("produce_pulse_shot", "Produce Pulse Shot", "Uvaří Pulse Shot.", "+pulse shot, +vliv, +heat", 4e-3, 3, out("pulse-shot", 1), 1, { chemicals: 2, biomass: 1 }),
      legacyAction("produce_velvet_smoke", "Produce Velvet Smoke", "Vyrobí Velvet Smoke.", "+velvet smoke, +vliv, +heat", 4e-3, 2, out("velvet-smoke", 2), 1, out("biomass", 2))
    ]),
    building("smuggling_tunnel", "Pašovací tunel", "park", "Smuggling", "Skrytý logistický koridor pro dirty cash, drogy, suroviny a informace.", perMinuteStat(0.2, 3, 4.3, 18), [
      action({ actionId: "smuggling_big_shipment", label: "Big shipment", description: "Velká zásilka projde tunelem.", effectSummary: "+dirty cash, +drugs, +tech core, +heat", heatGain: 5, outputGain: resources({ "dirty-cash": 520, "neon-dust": 1, "tech-core": 1 }), influenceChange: 1 }),
      action({ actionId: "smuggling_flow_boost", label: "Přesunout zásilku", description: "Tok zásilek dočasně zvedne dirty income.", effectSummary: "+dirty income, +heat na 10 minut", durationMs: 10 * minute, heatGain: 4, effectModifiers: { dirtyIncomeMultiplier: 1.3 } }),
      action({ actionId: "smuggling_reduce_trace", label: "Snížit stopu", description: "Stopa zásilky bude snížená a síť předá drby z okolí.", effectSummary: "-heat, +info, +vliv", heatGain: -3, influenceChange: 2 })
    ]),
    building("convenience_store", "Večerka", "park", "Economy / dirty cash / rumors / influence / street life", "Večerka generuje malé čisté peníze, drobné dirty cash, trochu vlivu a lokální pouliční drby. Zářivky bzučí, dveře pípají a kamera nad regálem vidí víc, než by měla. Večerka není nebezpečná. Nebezpeční jsou lidé, kteří se v ní v noci zastavují.", perMinuteStat(32, 18, 72, 144, 1), []),
    building("strip_club", "Strip Club", "park", "Economy / influence / rumors / social network", "Strip Club generuje peníze, vliv a drby. Není to jen podnik. Je to místo, kde město mluví. Neon na mokrém skle, basy pod podlahou a VIP salonek, kde se šeptá víc než v kanceláři starosty.", perMinuteStat(75, 65, 259.2, 547.2, 1), [
      action({ actionId: "vip_lounge", label: "VIP salonek", description: "Dočasně zvýší clean cash, dirty cash, vliv, heat a šanci na drb. Nestackuje se sám se sebou.", effectSummary: "Cena 800 clean cash, +cash, +vliv, +heat, +10 % rumor chance na 8 minut", cooldownMs: 18 * minute, durationMs: 8 * minute, inputCost: out("cash", 800), effectModifiers: { cleanIncomeMultiplier: 1.45, dirtyIncomeMultiplier: 1.35, influenceMultiplier: 1.55, heatMultiplier: 1.5 } }),
      action({ actionId: "bar_whispers", label: "Šeptanda u baru", description: "Za vliv okamžitě vygeneruje pravděpodobnostní drb. Drb může být falešný.", effectSummary: "Cena 25 influence, instantní drb, heat +2", cooldownMs: 14 * minute, heatGain: 2 }),
      action({ actionId: "private_party", label: "Soukromá party", description: "Přidá okamžitý vliv, dočasně zvýší influence production a může přinést kontakt, extra drb nebo skandál.", effectSummary: "Cena 1500 clean cash, +8 influence, +70 % influence na 10 minut, heat +6, riziko skandálu 12 %", cooldownMs: 24 * minute, durationMs: 10 * minute, inputCost: out("cash", 1500), heatGain: 6, influenceChange: 8, effectModifiers: { influenceMultiplier: 1.7 } })
    ]),
    building("street_dealers", "Pouliční dealeři", "park", "Distribution", "Pouliční distribuční síť pro drogy, dirty cash a lokální heat.", perMinuteStat(0.1, 4.5, 7, 3.5), [
      action({ actionId: "street_dealers_aggressive_push", label: "Rozšířit distribuci", description: "Distribuce zvedne dirty cash a income.", effectSummary: "+dirty cash, +dirty income, +heat", durationMs: 10 * minute, heatGain: 4, outputGain: out("dirty-cash", 360), effectModifiers: { dirtyIncomeMultiplier: 1.35 } }),
      action({ actionId: "street_dealers_collect_cash", label: "Vybrat cash", description: "Hotový cash se vybere.", effectSummary: "+dirty cash, +heat", heatGain: 3, outputGain: out("dirty-cash", 280) }),
      action({ actionId: "street_dealers_move_stash", label: "Přesunout stash", description: "Stash se přesune do zásob.", effectSummary: "+biomass, +heat", heatGain: 1, outputGain: out("biomass", 2) })
    ])
  ];
  const getAllPublicBuildingDefinitions = () => publicBuildingDefinitions.map((definition) => ({
    ...definition,
    nameVariants: [...definition.nameVariants],
    stats: { ...definition.stats },
    specialActions: definition.specialActions.map((buildingAction) => ({
      ...buildingAction,
      inputCost: { ...buildingAction.inputCost },
      outputGain: { ...buildingAction.outputGain },
      effectModifiers: buildingAction.effectModifiers ? { ...buildingAction.effectModifiers } : void 0
    }))
  }));
  const baseBuildingActionsConfig = Object.fromEntries(
    getAllPublicBuildingDefinitions().flatMap(
      (definition) => definition.specialActions.map((action2) => [
        action2.actionId,
        {
          actionId: action2.actionId,
          buildingType: definition.buildingTypeId,
          label: action2.label,
          description: action2.description,
          durationMs: action2.durationMs,
          cooldownMs: action2.cooldownMs,
          inputCost: { ...action2.inputCost },
          outputGain: { ...action2.outputGain },
          heatGain: action2.heatGain,
          influenceChange: action2.influenceChange,
          effectModifiers: action2.effectModifiers ? { ...action2.effectModifiers } : void 0,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: action2.reportText
        }
      ])
    )
  );
  const baseFixedBuildingsConfig = Object.fromEntries(
    getAllPublicBuildingDefinitions().map((definition) => [
      definition.buildingTypeId,
      {
        ...definition.stats
      }
    ])
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
    districtControlVictoryThreshold: 1,
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
      minAttackDurationTicks: 2,
      attackHeatGain: 6,
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
    fixedBuildings: baseFixedBuildingsConfig,
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
  const freeModeApartmentBlockConfig = {
    id: "apartment_block",
    buildingTypeId: "apartment_block",
    countOnMap: 29,
    category: ["population", "gang_members"],
    populationPerMinute: 2,
    baseCapacity: 50,
    cleanCashPerMinute: 0,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0,
    noAuditRisk: true,
    noLaundering: true,
    productionStopsAtCapacity: true,
    requiresManualCollect: true,
    allowPartialCollect: true,
    network: {
      populationProductionBonusPctPerExtraBlock: 6,
      capacityBonusPctPerExtraBlock: 8,
      maxPopulationProductionMultiplier: 1.55,
      maxCapacityMultiplier: 1.75
    },
    collectPopulation: {
      actionId: "collect_population",
      cooldownMinutes: 0
    }
  };
  const freeModeArcadeConfig = {
    id: "arcade",
    buildingTypeId: "arcade",
    countOnMap: 20,
    category: ["economy", "dirty_cash", "laundering", "network"],
    cleanCashPerMinute: 42,
    dirtyCashPerMinute: 72,
    influencePerMinute: 0.18,
    heatPerMinute: 0.12,
    launderingCapacity: 3800,
    baseAuditRiskPct: 3,
    auditWindowMinutes: 30,
    auditCheckEveryMinutes: 7,
    network: {
      incomeBonusPctPerExtraArcade: 5,
      launderingLimitBonusPctPerExtraArcade: 6,
      heatBonusPctPerExtraArcade: 3,
      maxIncomeMultiplier: 1.45,
      maxLaunderingLimitMultiplier: 1.55,
      maxHeatMultiplier: 1.27
    },
    nightMachines: {
      actionId: "night_machines",
      cooldownMinutes: 16,
      durationMinutes: 7,
      cleanIncomeBonusPct: 35,
      dirtyIncomeBonusPct: 65,
      influenceBonusPct: 15,
      heatBonusPct: 45,
      auditRiskBonusPct: 4
    },
    backCashdesk: {
      actionId: "back_cashdesk",
      cooldownMinutes: 12,
      minimumDirtyCash: 500,
      dirtyCashSharePct: 13,
      maxDirtyCashPerAction: 3800,
      feePct: 15,
      heatGain: 3,
      influenceGain: 1,
      auditRiskBonusPct: 3,
      auditRiskDurationMinutes: 8
    },
    auditRiskTiers: [
      { maxLaunderedAmount: 2e3, riskPct: 3 },
      { maxLaunderedAmount: 6e3, riskPct: 7 },
      { maxLaunderedAmount: 12e3, riskPct: 14 },
      { maxLaunderedAmount: 24e3, riskPct: 24 },
      { maxLaunderedAmount: null, riskPct: 36 }
    ],
    auditConsequences: {
      machineInspection: { incomePenaltyPct: 6, durationMinutes: 8 },
      seizedMachine: { dirtyIncomePenaltyPct: 8, durationMinutes: 10 },
      closedBackRoom: { actionBlockedMinutes: 7 },
      operatingFine: { cleanCashLoss: 1200 },
      localRaid: { heatGain: 8 }
    }
  };
  const freeModeCasinoConfig = {
    buildingTypeId: "casino",
    countOnMap: 3,
    category: ["economy", "laundering", "high-risk"],
    cleanCashPerMinute: 140,
    dirtyCashPerMinute: 260,
    influencePerMinute: 0.7,
    heatPerMinute: 0.45,
    launderingCapacity: 18e3,
    baseAuditRiskPct: 8,
    auditWindowMinutes: 30,
    auditCheckEveryMinutes: 5,
    quietBackroom: {
      actionId: "quiet_backroom",
      cooldownMinutes: 14,
      minimumDirtyCash: 1500,
      dirtyCashSharePct: 24,
      maxDirtyCashPerAction: 18e3,
      feePct: 9,
      heatGain: 7,
      influenceGain: 3,
      auditRiskBonusPct: 6,
      auditRiskDurationMinutes: 10
    },
    vipNight: {
      actionId: "vip_night",
      cooldownMinutes: 26,
      durationMinutes: 10,
      cleanIncomeBonusPct: 70,
      dirtyIncomeBonusPct: 55,
      influenceBonusPct: 25,
      heatBonusPct: 60,
      auditRiskBonusPct: 8
    },
    bribedInspector: {
      actionId: "bribed_inspector",
      cooldownMinutes: 32,
      cleanCashCost: 5500,
      protectionMinutes: 12,
      failureChancePct: 14,
      successHeatReduction: 16,
      successAuditRiskReductionPct: 35,
      successInfluenceGain: 4,
      failureHeatGain: 12,
      failureAuditRiskBonusPct: 10,
      failureAuditRiskDurationMinutes: 8
    },
    auditRiskTiers: [
      { maxLaunderedAmount: 5e3, riskPct: 6 },
      { maxLaunderedAmount: 12e3, riskPct: 13 },
      { maxLaunderedAmount: 25e3, riskPct: 24 },
      { maxLaunderedAmount: 45e3, riskPct: 38 },
      { maxLaunderedAmount: null, riskPct: 55 }
    ],
    auditConsequences: {
      lightInspection: { incomePenaltyPct: 10, durationMinutes: 8 },
      seizedBooks: { dirtyCashLossPct: 12 },
      frozenAccounts: { launderingBlockedMinutes: 8 },
      policeRaid: { heatGain: 20, incomePenaltyPct: 20, durationMinutes: 10 },
      closedVipLounge: { vipBlockedMinutes: 12 }
    },
    upgrades: [
      { level: 1, cleanCashCost: 0, incomeBonusPct: 0, launderingLimitBonusPct: 0 },
      { level: 2, cleanCashCost: 7500, techCoreCost: 3, incomeBonusPct: 12, launderingLimitBonusPct: 8 },
      { level: 3, cleanCashCost: 18e3, techCoreCost: 7, incomeBonusPct: 25, launderingLimitBonusPct: 16, feeReductionPct: 2 },
      { level: 4, cleanCashCost: 38e3, techCoreCost: 14, combatModuleCost: 3, incomeBonusPct: 40, launderingLimitBonusPct: 25, actionHeatReductionPct: 8 }
    ]
  };
  const freeModeClinicConfig = {
    id: "clinic",
    buildingTypeId: "clinic",
    countOnMap: 14,
    category: ["economy", "recovery", "support"],
    cleanCashPerMinute: 55,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0.03,
    noLaundering: true,
    noAuditRisk: true,
    recovery: {
      baseRecoveryRatePct: 15,
      recoveryRatePctPerExtraClinic: 3,
      maxRecoveryRatePct: 40,
      poolTtlMinutes: 20,
      toxicTrapRateMultiplier: 0.5
    },
    network: {
      incomeBonusPctPerExtraClinic: 5,
      heatBonusPctPerExtraClinic: 3,
      maxIncomeMultiplier: 1.4,
      maxHeatMultiplier: 1.24
    },
    stabilizationProtocol: {
      actionId: "stabilization_protocol",
      cooldownMinutes: 18,
      cleanCashCost: 1200,
      heatGain: 1
    }
  };
  const freeModeConvenienceStoreConfig = {
    id: "convenience_store",
    buildingTypeId: "convenience_store",
    countOnMap: 17,
    category: ["economy", "dirty_cash", "rumors", "influence", "street_life"],
    cleanCashPerMinute: 32,
    dirtyCashPerMinute: 18,
    influencePerMinute: 0.1,
    heatPerMinute: 0.05,
    noSpecialActions: true,
    noLaundering: true,
    noAuditRisk: true,
    passiveRumorIntervalMinutes: 10,
    baseRumorChancePct: 11,
    truthChanceByOwnedCount: [
      { minOwned: 1, maxOwned: 2, truthChancePct: 42 },
      { minOwned: 3, maxOwned: 5, truthChancePct: 48 },
      { minOwned: 6, maxOwned: 8, truthChancePct: 54 },
      { minOwned: 9, maxOwned: null, truthChancePct: 58 }
    ],
    districtHintChancePct: 22,
    areaHintChancePct: 12,
    buildingHintChancePct: 6,
    rumorTypes: [
      "night_movement",
      "suspicious_purchase",
      "courier_trace",
      "small_conflict",
      "police_patrol",
      "robbery_preparation",
      "possible_trap",
      "weak_defense",
      "dirty_cash_movement",
      "fake"
    ],
    network: {
      cleanIncomeBonusPctPerExtraStore: 3.5,
      dirtyIncomeBonusPctPerExtraStore: 3.5,
      influenceBonusPctPerExtraStore: 4,
      rumorChanceBonusPctPerExtraStore: 6,
      heatBonusPctPerExtraStore: 2,
      maxCleanIncomeMultiplier: 1.25,
      maxDirtyIncomeMultiplier: 1.25,
      maxInfluenceMultiplier: 1.3,
      maxRumorMultiplier: 1.45,
      maxHeatMultiplier: 1.16
    },
    restaurantSynergy: {
      firstStoreThreshold: 3,
      firstRestaurantThreshold: 3,
      firstCivilRumorChanceBonusPct: 5,
      secondStoreThreshold: 6,
      secondRestaurantThreshold: 6,
      secondCivilRumorChanceBonusPct: 8,
      truthStoreThreshold: 8,
      truthRestaurantThreshold: 10,
      civilRumorTruthBonusPct: 5
    }
  };
  const freeModeExchangeOfficeConfig = {
    id: "exchange_office",
    buildingTypeId: "exchange",
    countOnMap: 13,
    category: ["economy", "laundering", "network"],
    cleanCashPerMinute: 70,
    dirtyCashPerMinute: 95,
    influencePerMinute: 0.28,
    heatPerMinute: 0.16,
    launderingCapacity: 6e3,
    baseAuditRiskPct: 4,
    auditWindowMinutes: 30,
    auditCheckEveryMinutes: 6,
    network: {
      incomeBonusPctPerExtraExchange: 8,
      launderingLimitBonusPctPerExtraExchange: 10,
      heatBonusPctPerExtraExchange: 4,
      maxIncomeMultiplier: 1.48,
      maxLaunderingLimitMultiplier: 1.6,
      maxHeatMultiplier: 1.24
    },
    goodRate: {
      actionId: "good_rate",
      cooldownMinutes: 11,
      minimumDirtyCash: 800,
      dirtyCashSharePct: 16,
      maxDirtyCashPerAction: 6e3,
      feePct: 12,
      heatGain: 4,
      influenceGain: 1.5,
      auditRiskBonusPct: 4,
      auditRiskDurationMinutes: 8
    },
    auditRiskTiers: [
      { maxLaunderedAmount: 3e3, riskPct: 4 },
      { maxLaunderedAmount: 8e3, riskPct: 9 },
      { maxLaunderedAmount: 16e3, riskPct: 17 },
      { maxLaunderedAmount: 3e4, riskPct: 28 },
      { maxLaunderedAmount: null, riskPct: 42 }
    ],
    auditConsequences: {
      suspiciousTransaction: { incomePenaltyPct: 8, durationMinutes: 8 },
      blockedTransfer: { actionBlockedMinutes: 7 },
      lostClient: { dirtyIncomePenaltyPct: 10, durationMinutes: 10 },
      documentCheck: { heatGain: 10 },
      seizedCash: { dirtyCashLossPct: 8 }
    }
  };
  const freeModeGarageConfig = {
    id: "garage",
    buildingTypeId: "garage",
    countOnMap: 16,
    category: ["economy", "logistics", "cooldown_multiplier"],
    cleanCashPerMinute: 42,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0.06,
    actions: [],
    noSpecialActions: true,
    noLaundering: true,
    noAuditRisk: true,
    cooldownReduction: {
      reductionPctPerGarage: 2,
      maxReductionPct: 16,
      fullBonusActionCategories: [
        "gangMovement",
        "attackPreparation",
        "districtRobbery",
        "equipmentTransfer",
        "resourceTransfer",
        "defenseRepair",
        "defenseRestore"
      ],
      halfBonusActionCategories: [
        "districtSpy",
        "trapDetection",
        "clinicRecovery",
        "factoryProductionActions",
        "armoryProductionActions"
      ],
      excludedActionCategories: [
        "moneyLaundering",
        "casinoActions",
        "exchangeOfficeActions",
        "arcadeLaunderingActions",
        "vipBoosts",
        "rumorGeneration",
        "passiveProduction"
      ]
    },
    network: {
      incomeBonusPctPerExtraGarage: 3,
      heatBonusPctPerExtraGarage: 2,
      maxIncomeMultiplier: 1.21,
      maxHeatMultiplier: 1.14
    }
  };
  const freeModePowerStationConfig = {
    id: "power_station",
    buildingTypeId: "power_station",
    countOnMap: 9,
    category: ["infrastructure", "support", "defense_multiplier"],
    cleanCashPerMinute: 50,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0.08,
    noPowerCapacity: true,
    noEnergyResource: true,
    noLaundering: true,
    noAuditRisk: true,
    infrastructure: {
      bonusPctPerStation: 4,
      maxBonusPct: 28,
      weights: {
        factoryProductionSpeed: 1,
        armoryProductionSpeed: 1,
        warehouseStorageCapacity: 0.7,
        clinicRecoveryRate: 0.5,
        casinoIncome: 0.4,
        arcadeIncome: 0.4,
        exchangeIncome: 0.4,
        stripClubIncome: 0.3,
        apartmentPopulationProduction: 0.25
      }
    },
    network: {
      incomeBonusPctPerExtraStation: 4,
      heatBonusPctPerExtraStation: 3,
      maxIncomeMultiplier: 1.24,
      maxHeatMultiplier: 1.18
    },
    defense: {
      cameraStrengthBonusPctPerStation: 5,
      alarmStrengthBonusPctPerStation: 5,
      maxCameraStrengthBonusPct: 35,
      maxAlarmStrengthBonusPct: 35
    },
    backupGridSwitch: {
      actionId: "backup_grid_switch",
      cooldownMinutes: 22,
      durationMinutes: 8,
      cleanCashCost: 1200,
      heatGain: 3,
      temporaryInfrastructureBonusPct: 12,
      cameraStrengthBonusPct: 20,
      alarmStrengthBonusPct: 20,
      factoryProductionSpeedBonusPct: 10,
      armoryProductionSpeedBonusPct: 10
    }
  };
  const freeModeRecyclingCenterConfig = {
    id: "recycling_center",
    buildingTypeId: "recycling_center",
    countOnMap: 14,
    category: ["support", "salvage", "item_recovery"],
    cleanCashPerMinute: 40,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0.08,
    noLaundering: true,
    noAuditRisk: true,
    noPopulationProduction: true,
    noPopulationRecovery: true,
    salvage: {
      baseRatePct: 12,
      ratePctPerExtraCenter: 3,
      maxRatePct: 34,
      poolTtlMinutes: 18,
      rareItems: ["tech-core", "combat-module", "ghost-serum", "overdrive-x", "grenade", "smg", "bazooka", "defense-tower"],
      recoverableItems: {
        chemicals: { itemName: "Chemicals", category: "materials" },
        biomass: { itemName: "Biomass", category: "materials" },
        "metal-parts": { itemName: "Metal Parts", category: "materials" },
        "tech-core": { itemName: "Tech Core", category: "rareComponents" },
        "combat-module": { itemName: "Combat Module", category: "rareComponents" },
        "neon-dust": { itemName: "Neon Dust", category: "drugsAndBoosts" },
        "pulse-shot": { itemName: "Pulse Shot", category: "drugsAndBoosts" },
        "velvet-smoke": { itemName: "Velvet Smoke", category: "drugsAndBoosts" },
        "ghost-serum": { itemName: "Ghost Serum", category: "drugsAndBoosts" },
        "overdrive-x": { itemName: "Overdrive X", category: "drugsAndBoosts" },
        "baseball-bat": { itemName: "Baseballová pálka", category: "weapons" },
        pistol: { itemName: "Pouliční pistole", category: "weapons" },
        grenade: { itemName: "Granát", category: "weapons" },
        smg: { itemName: "Samopal", category: "weapons" },
        bazooka: { itemName: "Bazuka", category: "weapons" },
        vest: { itemName: "Neprůstřelná vesta", category: "defenseItems" },
        barricades: { itemName: "Ocelové barikády", category: "defenseItems" },
        cameras: { itemName: "Bezpečnostní kamery", category: "defenseItems" },
        "defense-tower": { itemName: "Automatické kulometné stanoviště", category: "defenseItems" },
        alarm: { itemName: "Alarm", category: "defenseItems" }
      }
    },
    extractLosses: {
      actionId: "extract_losses",
      cooldownMinutes: 16,
      cleanCashCost: 900,
      heatGain: 2
    },
    network: {
      incomeBonusPctPerExtraCenter: 4,
      heatBonusPctPerExtraCenter: 3,
      maxIncomeMultiplier: 1.28,
      maxHeatMultiplier: 1.21
    }
  };
  const freeModeRecruitmentCenterConfig = {
    id: "recruitment_center",
    buildingTypeId: "recruitment_center",
    countOnMap: 16,
    category: ["support", "population_support", "combat_multiplier"],
    cleanCashPerMinute: 35,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0.07,
    noSpecialActions: true,
    noLaundering: true,
    noAuditRisk: true,
    populationSupport: {
      populationProductionBonusPctPerCenter: 3,
      apartmentCapacityBonusPctPerCenter: 4,
      maxPopulationProductionBonusPct: 24,
      maxApartmentCapacityBonusPct: 32
    },
    combatSupport: {
      attackWeaponStrengthBonusPctPerCenter: 2,
      defenseItemStrengthBonusPctPerCenter: 1.5,
      maxAttackWeaponStrengthBonusPct: 16,
      maxDefenseItemStrengthBonusPct: 12,
      maxCombinedCameraAlarmBonusPct: 50
    },
    network: {
      incomeBonusPctPerExtraCenter: 3,
      heatBonusPctPerExtraCenter: 3,
      maxIncomeMultiplier: 1.21,
      maxHeatMultiplier: 1.21
    }
  };
  const freeModeRestaurantConfig = {
    id: "restaurant",
    buildingTypeId: "restaurant",
    countOnMap: 36,
    category: ["economy", "rumors", "influence", "city_life"],
    cleanCashPerMinute: 38,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0.12,
    heatPerMinute: 0.04,
    noSpecialActions: true,
    noLaundering: true,
    noAuditRisk: true,
    passiveRumorIntervalMinutes: 10,
    baseRumorChancePct: 9,
    truthChanceByOwnedCount: [
      { minOwned: 1, maxOwned: 2, truthChancePct: 45 },
      { minOwned: 3, maxOwned: 5, truthChancePct: 50 },
      { minOwned: 6, maxOwned: 9, truthChancePct: 55 },
      { minOwned: 10, maxOwned: null, truthChancePct: 60 }
    ],
    districtHintChancePct: 18,
    buildingHintChancePct: 8,
    rumorTypes: [
      "civilian_movement",
      "suspicious_delivery",
      "police_interest",
      "economic_activity",
      "storage_movement",
      "attack_preparation",
      "weak_defense",
      "fake"
    ],
    network: {
      incomeBonusPctPerExtraRestaurant: 2.5,
      influenceBonusPctPerExtraRestaurant: 3,
      rumorChanceBonusPctPerExtraRestaurant: 4,
      heatBonusPctPerExtraRestaurant: 2,
      maxIncomeMultiplier: 1.25,
      maxInfluenceMultiplier: 1.3,
      maxRumorMultiplier: 1.4,
      maxHeatMultiplier: 1.2
    }
  };
  const freeModeShoppingMallConfig = {
    id: "shopping_mall",
    buildingTypeId: "shopping_mall",
    countOnMap: 10,
    category: ["economy", "market", "influence", "multiplier"],
    cleanCashPerMinute: 95,
    dirtyCashPerMinute: 22,
    influencePerMinute: 0.24,
    heatPerMinute: 0.09,
    actions: [],
    noSpecialActions: true,
    noLaundering: true,
    noAuditRisk: true,
    marketDiscount: {
      discountPctPerMall: 2,
      maxDiscountPct: 14,
      regularMarketWeight: 1,
      blackMarketWeight: 0.4,
      playerMarketWeight: 0,
      emergencyMarketWeight: 0,
      minFinalPriceMultiplier: 0.7
    },
    marketFeeReduction: {
      feeReductionPctPerMall: 5,
      maxFeeReductionPct: 30
    },
    network: {
      cleanIncomeBonusPctPerExtraMall: 5,
      dirtyIncomeBonusPctPerExtraMall: 5,
      influenceBonusPctPerExtraMall: 4,
      heatBonusPctPerExtraMall: 3,
      maxCleanIncomeMultiplier: 1.3,
      maxDirtyIncomeMultiplier: 1.3,
      maxInfluenceMultiplier: 1.24,
      maxHeatMultiplier: 1.18
    }
  };
  const freeModeStripClubConfig = {
    id: "strip_club",
    buildingTypeId: "strip_club",
    countOnMap: 17,
    category: ["economy", "influence", "rumors", "social_network"],
    cleanCashPerMinute: 75,
    dirtyCashPerMinute: 65,
    influencePerMinute: 0.38,
    heatPerMinute: 0.18,
    noLaundering: true,
    noAuditRisk: true,
    passiveRumorIntervalMinutes: 10,
    baseRumorChancePct: 18,
    baseTruthChancePct: 55,
    truthChancePctPerExtraClub: 3,
    maxTruthChancePct: 75,
    districtHintChancePct: 35,
    buildingHintChancePct: 20,
    rumorTypes: ["money", "relationships", "police", "attacks", "storage", "traps", "laundering", "fake"],
    network: {
      incomeBonusPctPerExtraStripClub: 5,
      influenceBonusPctPerExtraStripClub: 7,
      rumorChanceBonusPctPerExtraStripClub: 8,
      heatBonusPctPerExtraStripClub: 4,
      maxIncomeMultiplier: 1.35,
      maxInfluenceMultiplier: 1.5,
      maxRumorMultiplier: 1.6,
      maxHeatMultiplier: 1.28
    },
    vipLounge: {
      actionId: "vip_lounge",
      cooldownMinutes: 18,
      durationMinutes: 8,
      cleanCashCost: 800,
      cleanIncomeBonusPct: 45,
      dirtyIncomeBonusPct: 35,
      influenceBonusPct: 55,
      heatBonusPct: 50,
      rumorChanceFlatBonusPct: 10
    },
    barWhispers: {
      actionId: "bar_whispers",
      cooldownMinutes: 14,
      influenceCost: 25,
      heatGain: 2
    },
    privateParty: {
      actionId: "private_party",
      cooldownMinutes: 24,
      durationMinutes: 10,
      cleanCashCost: 1500,
      instantInfluenceGain: 8,
      influenceProductionBonusPct: 70,
      extraRumorChancePct: 45,
      contactChancePct: 20,
      heatGain: 6,
      scandalChancePct: 12,
      scandalHeatGain: 10,
      scandalInfluenceLoss: 4
    },
    contacts: [
      { id: "city_official", label: "Městský úředník", effectSummary: "next heat gain -10 % na 10 minut", durationMinutes: 10 },
      { id: "dirty_lawyer", label: "Špinavý právník", effectSummary: "next audit or raid chance -8 % na 10 minut", durationMinutes: 10 },
      { id: "street_informant", label: "Pouliční informátor", effectSummary: "next rumor truth chance +20 %" },
      { id: "contact_dealer", label: "Dealer kontaktů", effectSummary: "next influence action cost -10 %" },
      { id: "bodyguard_broker", label: "Bodyguard broker", effectSummary: "next defense action effectiveness +10 %" }
    ]
  };
  const freeModeWarehouseConfig = {
    id: "warehouse",
    buildingTypeId: "warehouse",
    countOnMap: 18,
    category: ["economy", "storage", "logistics"],
    cleanCashPerMinute: 45,
    dirtyCashPerMinute: 0,
    influencePerMinute: 0,
    heatPerMinute: 0.06,
    auditRisk: 0,
    noLaundering: true,
    specialActions: "none",
    storageCapacityBonus: 500,
    storageCapacities: {
      genericResources: 500,
      chemicals: 350,
      biomass: 350,
      metalParts: 400,
      techCore: 120,
      combatModule: 80,
      drugsAndBoosts: 220,
      weaponsAndDefense: 160
    },
    network: {
      incomeBonusPctPerExtraWarehouse: 4,
      storageCapacityBonusPctPerExtraWarehouse: 10,
      heatBonusPctPerExtraWarehouse: 3,
      maxIncomeMultiplier: 1.36,
      maxStorageCapacityMultiplier: 1.9,
      maxHeatMultiplier: 1.27
    },
    upgrades: {
      1: { cleanCashCost: 0, metalPartsCost: 0, techCoreCost: 0, incomeBonusPct: 0, storageBonusPct: 0, heatReductionPct: 0 },
      2: { cleanCashCost: 4e3, metalPartsCost: 2, techCoreCost: 0, incomeBonusPct: 10, storageBonusPct: 12, heatReductionPct: 0 },
      3: { cleanCashCost: 9e3, metalPartsCost: 5, techCoreCost: 1, incomeBonusPct: 20, storageBonusPct: 25, heatReductionPct: 0 },
      4: { cleanCashCost: 18e3, metalPartsCost: 12, techCoreCost: 3, incomeBonusPct: 30, storageBonusPct: 40, heatReductionPct: 10 }
    }
  };
  const freeModeOverride = {
    mode: "free",
    tickRateMs: 5e3,
    balance: {
      incomeMultiplier: 1.2,
      productionMultiplier: 1.2,
      cooldownMultiplier: 0.8,
      maxPlayersPerServer: 20,
      maxAllianceSize: 4,
      buildSlotLimit: 8,
      eventFrequencyMultiplier: 1.2,
      policePressureMultiplier: 0.9,
      raidIntensityMultiplier: 0.9,
      expansionSpeedMultiplier: 1.3,
      dayLengthTicks: 8,
      nightLengthTicks: 8,
      victoryConditionKey: "fast-control",
      districtControlVictoryThreshold: 0.85,
      conflict: {
        spyCooldownTicks: 1,
        attackCooldownTicks: 36,
        minAttackDurationTicks: 36,
        attackHeatGain: 8,
        spyBaseSuccessChance: 0.76,
        spyTrapRevealChance: 0.2,
        trapAttackLosses: 2,
        reportsLimit: 6,
        catastropheChance: 0.06
      },
      startingResources: {
        cash: 1500,
        "dirty-cash": 300,
        chemicals: 10,
        biomass: 6,
        "metal-parts": 8,
        "tech-core": 2
      },
      fixedBuildings: {
        casino: {
          cleanPerHour: freeModeCasinoConfig.cleanCashPerMinute * 60,
          dirtyPerHour: freeModeCasinoConfig.dirtyCashPerMinute * 60,
          heatPerDay: freeModeCasinoConfig.heatPerMinute * 60 * 24,
          influencePerDay: freeModeCasinoConfig.influencePerMinute * 60 * 24,
          maxLevel: 4
        },
        exchange: {
          cleanPerHour: freeModeExchangeOfficeConfig.cleanCashPerMinute * 60,
          dirtyPerHour: freeModeExchangeOfficeConfig.dirtyCashPerMinute * 60,
          heatPerDay: 230.4,
          influencePerDay: 403.2,
          maxLevel: 1
        },
        arcade: {
          cleanPerHour: freeModeArcadeConfig.cleanCashPerMinute * 60,
          dirtyPerHour: freeModeArcadeConfig.dirtyCashPerMinute * 60,
          heatPerDay: 172.8,
          influencePerDay: 259.2,
          maxLevel: 1
        },
        apartment_block: {
          cleanPerHour: 0,
          dirtyPerHour: 0,
          heatPerDay: 0,
          influencePerDay: 0,
          maxLevel: 1
        },
        warehouse: {
          cleanPerHour: freeModeWarehouseConfig.cleanCashPerMinute * 60,
          dirtyPerHour: 0,
          heatPerDay: 86.4,
          influencePerDay: 0,
          maxLevel: 4
        },
        clinic: {
          cleanPerHour: freeModeClinicConfig.cleanCashPerMinute * 60,
          dirtyPerHour: 0,
          heatPerDay: 43.2,
          influencePerDay: 0,
          maxLevel: 1
        },
        strip_club: {
          cleanPerHour: freeModeStripClubConfig.cleanCashPerMinute * 60,
          dirtyPerHour: freeModeStripClubConfig.dirtyCashPerMinute * 60,
          heatPerDay: freeModeStripClubConfig.heatPerMinute * 60 * 24,
          influencePerDay: freeModeStripClubConfig.influencePerMinute * 60 * 24,
          maxLevel: 1
        },
        power_station: {
          cleanPerHour: freeModePowerStationConfig.cleanCashPerMinute * 60,
          dirtyPerHour: 0,
          heatPerDay: 115.2,
          influencePerDay: 0,
          maxLevel: 1
        },
        restaurant: {
          cleanPerHour: freeModeRestaurantConfig.cleanCashPerMinute * 60,
          dirtyPerHour: 0,
          heatPerDay: 57.6,
          influencePerDay: 172.8,
          maxLevel: 1
        },
        convenience_store: {
          cleanPerHour: freeModeConvenienceStoreConfig.cleanCashPerMinute * 60,
          dirtyPerHour: freeModeConvenienceStoreConfig.dirtyCashPerMinute * 60,
          heatPerDay: freeModeConvenienceStoreConfig.heatPerMinute * 60 * 24,
          influencePerDay: freeModeConvenienceStoreConfig.influencePerMinute * 60 * 24,
          maxLevel: 1
        },
        shopping_mall: {
          cleanPerHour: freeModeShoppingMallConfig.cleanCashPerMinute * 60,
          dirtyPerHour: freeModeShoppingMallConfig.dirtyCashPerMinute * 60,
          heatPerDay: freeModeShoppingMallConfig.heatPerMinute * 60 * 24,
          influencePerDay: freeModeShoppingMallConfig.influencePerMinute * 60 * 24,
          maxLevel: 1
        },
        recruitment_center: {
          cleanPerHour: freeModeRecruitmentCenterConfig.cleanCashPerMinute * 60,
          dirtyPerHour: 0,
          heatPerDay: freeModeRecruitmentCenterConfig.heatPerMinute * 60 * 24,
          influencePerDay: 0,
          maxLevel: 1
        },
        garage: {
          cleanPerHour: freeModeGarageConfig.cleanCashPerMinute * 60,
          dirtyPerHour: 0,
          heatPerDay: freeModeGarageConfig.heatPerMinute * 60 * 24,
          influencePerDay: 0,
          maxLevel: 1
        },
        recycling_center: {
          cleanPerHour: freeModeRecyclingCenterConfig.cleanCashPerMinute * 60,
          dirtyPerHour: 0,
          heatPerDay: freeModeRecyclingCenterConfig.heatPerMinute * 60 * 24,
          influencePerDay: 0,
          maxLevel: 1
        }
      },
      buildingActions: {
        extract_losses: {
          actionId: "extract_losses",
          buildingType: "recycling_center",
          label: "Vytěžit ztráty",
          description: "Vrátí část neexpirovaných itemových ztrát ze salvage poolu. Nevrací populaci ani členy gangu.",
          durationMs: 0,
          cooldownMs: freeModeRecyclingCenterConfig.extractLosses.cooldownMinutes * 60 * 1e3,
          inputCost: { cash: freeModeRecyclingCenterConfig.extractLosses.cleanCashCost },
          outputGain: {},
          heatGain: freeModeRecyclingCenterConfig.extractLosses.heatGain,
          influenceChange: 0,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Recyklační centrum vytěžilo část ztracených itemů ze šrotu."
        },
        stabilization_protocol: {
          actionId: "stabilization_protocol",
          buildingType: "clinic",
          label: "Stabilizační protokol",
          description: "Za clean cash vrátí část neexpirovaných ztrát z recovery poolu do gangu a skladu.",
          durationMs: 0,
          cooldownMs: freeModeClinicConfig.stabilizationProtocol.cooldownMinutes * 60 * 1e3,
          inputCost: { cash: freeModeClinicConfig.stabilizationProtocol.cleanCashCost },
          outputGain: {},
          heatGain: freeModeClinicConfig.stabilizationProtocol.heatGain,
          influenceChange: 0,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Stabilizační protokol obnoví část nedávných ztrát. Recovery neprobíhá automaticky."
        },
        collect_population: {
          actionId: "collect_population",
          buildingType: "apartment_block",
          label: "Vybrat obyvatele",
          description: "Přesune lokálně uložené obyvatele z bytového bloku do globální populace hráče.",
          durationMs: 0,
          cooldownMs: 0,
          inputCost: {},
          outputGain: {},
          heatGain: 0,
          influenceChange: 0,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Vybere obyvatele z lokálního zásobníku bytového bloku."
        },
        night_machines: {
          actionId: "night_machines",
          buildingType: "arcade",
          label: "Noční automaty",
          description: "Na 7 minut zvýší produkci Herny, vliv, heat a audit risk.",
          durationMs: freeModeArcadeConfig.nightMachines.durationMinutes * 60 * 1e3,
          cooldownMs: freeModeArcadeConfig.nightMachines.cooldownMinutes * 60 * 1e3,
          inputCost: {},
          outputGain: {},
          heatGain: 0,
          influenceChange: 0,
          effectModifiers: {
            cleanIncomeMultiplier: 1 + freeModeArcadeConfig.nightMachines.cleanIncomeBonusPct / 100,
            dirtyIncomeMultiplier: 1 + freeModeArcadeConfig.nightMachines.dirtyIncomeBonusPct / 100,
            influenceMultiplier: 1 + freeModeArcadeConfig.nightMachines.influenceBonusPct / 100,
            heatMultiplier: 1 + freeModeArcadeConfig.nightMachines.heatBonusPct / 100
          },
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Aktivuje Noční automaty. Boost se sám se sebou nestackuje."
        },
        back_cashdesk: {
          actionId: "back_cashdesk",
          buildingType: "arcade",
          label: "Zadní pokladna",
          description: "Instantně vypere část aktuálního dirty cash přes zadní pokladnu Herny.",
          durationMs: 0,
          cooldownMs: freeModeArcadeConfig.backCashdesk.cooldownMinutes * 60 * 1e3,
          inputCost: {},
          outputGain: {},
          heatGain: freeModeArcadeConfig.backCashdesk.heatGain,
          influenceChange: freeModeArcadeConfig.backCashdesk.influenceGain,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
        },
        good_rate: {
          actionId: "good_rate",
          buildingType: "exchange",
          label: "Výhodný kurz",
          description: "Instantně vypere menší část aktuálního dirty cash přes síť směnáren.",
          durationMs: 0,
          cooldownMs: freeModeExchangeOfficeConfig.goodRate.cooldownMinutes * 60 * 1e3,
          inputCost: {},
          outputGain: {},
          heatGain: freeModeExchangeOfficeConfig.goodRate.heatGain,
          influenceChange: freeModeExchangeOfficeConfig.goodRate.influenceGain,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
        },
        quiet_backroom: {
          actionId: "quiet_backroom",
          buildingType: "casino",
          label: "Tichá herna",
          description: "Instantně vypere část aktuálního dirty cash přes tiché zázemí kasina.",
          durationMs: 0,
          cooldownMs: freeModeCasinoConfig.quietBackroom.cooldownMinutes * 60 * 1e3,
          inputCost: {},
          outputGain: {},
          heatGain: freeModeCasinoConfig.quietBackroom.heatGain,
          influenceChange: freeModeCasinoConfig.quietBackroom.influenceGain,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
        },
        vip_night: {
          actionId: "vip_night",
          buildingType: "casino",
          label: "VIP noc",
          description: "Na 10 minut výrazně zvýší casino income, vliv, heat a audit risk.",
          durationMs: freeModeCasinoConfig.vipNight.durationMinutes * 60 * 1e3,
          cooldownMs: freeModeCasinoConfig.vipNight.cooldownMinutes * 60 * 1e3,
          inputCost: {},
          outputGain: {},
          heatGain: 0,
          influenceChange: 0,
          effectModifiers: {
            cleanIncomeMultiplier: 1 + freeModeCasinoConfig.vipNight.cleanIncomeBonusPct / 100,
            dirtyIncomeMultiplier: 1 + freeModeCasinoConfig.vipNight.dirtyIncomeBonusPct / 100,
            influenceMultiplier: 1 + freeModeCasinoConfig.vipNight.influenceBonusPct / 100,
            heatMultiplier: 1 + freeModeCasinoConfig.vipNight.heatBonusPct / 100
          },
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Aktivuje VIP noc. Boost se sám se sebou nestackuje."
        },
        bribed_inspector: {
          actionId: "bribed_inspector",
          buildingType: "casino",
          label: "Podplacený inspektor",
          description: "Zaplatí inspektora. Úspěch sníží heat a audit risk, selhání zvýší policejní tlak.",
          durationMs: freeModeCasinoConfig.bribedInspector.protectionMinutes * 60 * 1e3,
          cooldownMs: freeModeCasinoConfig.bribedInspector.cooldownMinutes * 60 * 1e3,
          inputCost: { cash: freeModeCasinoConfig.bribedInspector.cleanCashCost },
          outputGain: {},
          heatGain: 0,
          influenceChange: 0,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Heat control akce s rizikem selhání."
        },
        vip_lounge: {
          actionId: "vip_lounge",
          buildingType: "strip_club",
          label: "VIP salonek",
          description: "Na 8 minut zvýší produkci Strip Clubu, vliv, heat a šanci na drb.",
          durationMs: freeModeStripClubConfig.vipLounge.durationMinutes * 60 * 1e3,
          cooldownMs: freeModeStripClubConfig.vipLounge.cooldownMinutes * 60 * 1e3,
          inputCost: { cash: freeModeStripClubConfig.vipLounge.cleanCashCost },
          outputGain: {},
          heatGain: 0,
          influenceChange: 0,
          effectModifiers: {
            cleanIncomeMultiplier: 1 + freeModeStripClubConfig.vipLounge.cleanIncomeBonusPct / 100,
            dirtyIncomeMultiplier: 1 + freeModeStripClubConfig.vipLounge.dirtyIncomeBonusPct / 100,
            influenceMultiplier: 1 + freeModeStripClubConfig.vipLounge.influenceBonusPct / 100,
            heatMultiplier: 1 + freeModeStripClubConfig.vipLounge.heatBonusPct / 100
          },
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "VIP salonek aktivní. Boost se sám se sebou nestackuje."
        },
        bar_whispers: {
          actionId: "bar_whispers",
          buildingType: "strip_club",
          label: "Šeptanda u baru",
          description: "Okamžitě vygeneruje pravděpodobnostní drb.",
          durationMs: 0,
          cooldownMs: freeModeStripClubConfig.barWhispers.cooldownMinutes * 60 * 1e3,
          inputCost: {},
          outputGain: {},
          heatGain: freeModeStripClubConfig.barWhispers.heatGain,
          influenceChange: 0,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Šeptanda u baru vygenerovala drb. Pravdivost není jistá."
        },
        private_party: {
          actionId: "private_party",
          buildingType: "strip_club",
          label: "Soukromá party",
          description: "Přidá vliv, dočasný influence boost a může přinést kontakt, extra drb nebo skandál.",
          durationMs: freeModeStripClubConfig.privateParty.durationMinutes * 60 * 1e3,
          cooldownMs: freeModeStripClubConfig.privateParty.cooldownMinutes * 60 * 1e3,
          inputCost: { cash: freeModeStripClubConfig.privateParty.cleanCashCost },
          outputGain: {},
          heatGain: freeModeStripClubConfig.privateParty.heatGain,
          influenceChange: freeModeStripClubConfig.privateParty.instantInfluenceGain,
          effectModifiers: {
            influenceMultiplier: 1 + freeModeStripClubConfig.privateParty.influenceProductionBonusPct / 100
          },
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Soukromá party proběhla. Výsledek může obsahovat kontakt, extra drb nebo skandál."
        },
        backup_grid_switch: {
          actionId: "backup_grid_switch",
          buildingType: "power_station",
          label: "Přepnutí na záložní síť",
          description: "Dočasně zvýší infrastructure bonus a posílí kamery, alarm, Továrny a Zbrojovky.",
          durationMs: freeModePowerStationConfig.backupGridSwitch.durationMinutes * 60 * 1e3,
          cooldownMs: freeModePowerStationConfig.backupGridSwitch.cooldownMinutes * 60 * 1e3,
          inputCost: { cash: freeModePowerStationConfig.backupGridSwitch.cleanCashCost },
          outputGain: {},
          heatGain: freeModePowerStationConfig.backupGridSwitch.heatGain,
          influenceChange: 0,
          requiredOwner: true,
          allowedIfContested: false,
          reportText: "Záložní síť aktivní. Infrastructure a defense systémy jsou dočasně posílené."
        }
      },
      casino: freeModeCasinoConfig,
      exchangeOffice: freeModeExchangeOfficeConfig,
      arcade: freeModeArcadeConfig,
      apartmentBlock: freeModeApartmentBlockConfig,
      warehouse: freeModeWarehouseConfig,
      clinic: freeModeClinicConfig,
      stripClub: freeModeStripClubConfig,
      restaurant: freeModeRestaurantConfig,
      convenienceStore: freeModeConvenienceStoreConfig,
      shoppingMall: freeModeShoppingMallConfig,
      recruitmentCenter: freeModeRecruitmentCenterConfig,
      garage: freeModeGarageConfig,
      recyclingCenter: freeModeRecyclingCenterConfig,
      powerStation: freeModePowerStationConfig
    },
    technical: {
      sessionTtlMs: 1e3 * 60 * 60 * 2,
      gameDurationMs: 1e3 * 60 * 60 * 2,
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
    var _a, _b, _c, _d;
    return {
      ...base,
      ...override,
      balance: {
        ...base.balance,
        ...override.balance,
        conflict: {
          ...base.balance.conflict,
          ...((_a = override.balance) == null ? void 0 : _a.conflict) ?? {}
        },
        fixedBuildings: {
          ...base.balance.fixedBuildings ?? {},
          ...((_b = override.balance) == null ? void 0 : _b.fixedBuildings) ?? {}
        },
        buildingActions: {
          ...base.balance.buildingActions ?? {},
          ...((_c = override.balance) == null ? void 0 : _c.buildingActions) ?? {}
        }
      },
      technical: {
        ...base.technical,
        ...override.technical,
        debug: {
          ...base.technical.debug,
          ...(_d = override.technical) == null ? void 0 : _d.debug
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
      incomeMultiplier: 0.85,
      productionMultiplier: 0.85,
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
      conflict: {
        spyCooldownTicks: 4,
        attackCooldownTicks: 48,
        minAttackDurationTicks: 48,
        attackHeatGain: 14,
        spyBaseSuccessChance: 0.66,
        spyTrapRevealChance: 0.28,
        trapAttackLosses: 2,
        reportsLimit: 10,
        catastropheChance: 0.1
      },
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
      sessionTtlMs: 1e3 * 60 * 60 * 24 * 10,
      gameDurationMs: 1e3 * 60 * 60 * 24 * 10,
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
    const victoryThreshold = config.balance.districtControlVictoryThreshold ?? 1;
    if (victoryThreshold <= 0 || victoryThreshold > 1) {
      throw new Error("Mode config requires districtControlVictoryThreshold between 0 and 1.");
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
      if ((config.balance.conflict.minAttackDurationTicks ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative minAttackDurationTicks.");
      }
      if ((config.balance.conflict.attackHeatGain ?? 0) < 0) {
        throw new Error("Conflict config requires a non-negative attackHeatGain.");
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
    for (const action2 of Object.values(config.balance.buildingActions ?? {})) {
      if (!action2.actionId || !action2.buildingType) {
        throw new Error("Building action config requires actionId and buildingType.");
      }
      if (action2.durationMs < 0 || action2.cooldownMs < 0) {
        throw new Error(`Building action "${action2.actionId}" requires non-negative durationMs and cooldownMs.`);
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
      set("commercial", "mid", "mid-corp-1", "Korporátní stabilita", ["shopping_mall", "restaurant"]),
      set("commercial", "mid", "mid-corp-2", "Administrativní utility", ["shopping_mall", "pharmacy", "restaurant"]),
      set("commercial", "mid", "mid-mall-1", "Hlavní retail", ["shopping_mall", "restaurant"]),
      set("commercial", "mid", "mid-mix-1", "Vyvážený obchod", ["restaurant", "pharmacy", "exchange"]),
      set("commercial", "mid", "mid-mix-2", "Prací front", ["auto_salon", "exchange", "restaurant"]),
      set("commercial", "top", "top-casino-1", "Kasino hotspot", ["casino", "restaurant"]),
      set("commercial", "top", "top-casino-2", "Shady premium", ["casino", "restaurant", "pharmacy"]),
      set("commercial", "top", "top-casino-3", "Black cash engine", ["casino", "exchange", "auto_salon"]),
      set("commercial", "top", "top-mall-1", "Prémiový retail", ["shopping_mall", "pharmacy", "restaurant"]),
      set("commercial", "top", "top-mall-2", "Financial boulevard", ["shopping_mall", "exchange", "restaurant"])
    ],
    residential: [
      set("residential", "early", "res-early-1", "Startovní růst", ["apartment_block", "garage"]),
      set("residential", "early", "res-early-2", "Stabilní základna", ["apartment_block", "arcade"]),
      set("residential", "early", "res-early-3", "První nábor", ["apartment_block", "recruitment_center"]),
      set("residential", "early", "res-early-4", "Obytná kontrola", ["apartment_block", "arcade", "garage"]),
      set("residential", "mid", "res-mid-1", "Mobilní posily", ["apartment_block", "recruitment_center", "garage"]),
      set("residential", "mid", "res-mid-2", "Udržitelný růst", ["apartment_block", "clinic"]),
      set("residential", "mid", "res-mid-3", "Disciplína a kvalita", ["apartment_block", "school"]),
      set("residential", "mid", "res-mid-4", "Loajalita a výcvik", ["arcade", "school"]),
      set("residential", "mid", "res-mid-5", "Regenerace fronty", ["recruitment_center", "clinic"]),
      set("residential", "mid", "res-mid-6", "Kontrolovaný development", ["apartment_block", "arcade", "school"]),
      set("residential", "late", "res-late-1", "Válečné zázemí", ["apartment_block", "recruitment_center", "clinic"]),
      set("residential", "late", "res-late-2", "Mobilní tlak", ["recruitment_center", "garage", "clinic"]),
      set("residential", "late", "res-late-3", "Loajální populace", ["apartment_block", "arcade", "clinic"]),
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
      set("industrial", "early", "ind-early-5", "Základní recyklace", ["factory", "recycling_center"]),
      set("industrial", "early", "ind-early-6", "Recyklační tok", ["warehouse", "recycling_center"]),
      set("industrial", "mid", "ind-mid-1", "Vojenská výroba", ["armory", "warehouse"]),
      set("industrial", "mid", "ind-mid-2", "Technický provoz", ["factory", "recycling_center"]),
      set("industrial", "mid", "ind-mid-3", "Efektivní řetězec", ["factory", "warehouse", "power_station"]),
      set("industrial", "mid", "ind-mid-4", "Zbrojní logistika", ["armory", "warehouse", "power_station"]),
      set("industrial", "mid", "ind-mid-5", "Recyklační sklad", ["warehouse", "recycling_center"]),
      set("industrial", "mid", "ind-mid-6", "Recyklace a obrana", ["recycling_center", "armory"]),
      set("industrial", "mid", "ind-mid-7", "Obnova zdrojů", ["factory", "recycling_center", "warehouse"]),
      set("industrial", "top", "ind-top-1", "Arms grid", ["factory", "armory", "warehouse"]),
      set("industrial", "top", "ind-top-2", "Power forge", ["factory", "armory", "power_station"]),
      set("industrial", "top", "ind-top-3", "Scrap foundry", ["armory", "recycling_center", "warehouse"]),
      set("industrial", "top", "ind-top-4", "Critical recovery", ["power_station", "recycling_center", "warehouse"]),
      set("industrial", "top", "ind-top-5", "Heavy recycle", ["armory", "recycling_center", "factory"]),
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
    runtime: {
      processedCommandIds: [...runtime.processedCommandIds],
      commandRateLimitWindow: {
        tick: runtime.commandRateLimitWindow.tick,
        commandCountsByPlayerId: {
          ...runtime.commandRateLimitWindow.commandCountsByPlayerId
        }
      }
    },
    state: runtime.state
  });
  const restoreInstanceState = (snapshot) => snapshot.state;
  const createPersistenceRestoreService = (snapshotRepository) => ({
    restore: async (runtime) => {
      var _a, _b;
      const snapshot = await snapshotRepository.loadLatest(runtime.record.id);
      if (!snapshot) {
        runtime.state = createInitialState(runtime.record.id, runtime.record.mode);
        runtime.processedCommandIds = /* @__PURE__ */ new Set();
        runtime.commandRateLimitWindow = {
          tick: runtime.state.root.tick,
          commandCountsByPlayerId: {}
        };
        return runtime;
      }
      runtime.state = restoreInstanceState(snapshot);
      runtime.processedCommandIds = new Set(((_a = snapshot.runtime) == null ? void 0 : _a.processedCommandIds) ?? []);
      runtime.commandRateLimitWindow = ((_b = snapshot.runtime) == null ? void 0 : _b.commandRateLimitWindow) ? {
        tick: snapshot.runtime.commandRateLimitWindow.tick,
        commandCountsByPlayerId: {
          ...snapshot.runtime.commandRateLimitWindow.commandCountsByPlayerId
        }
      } : {
        tick: runtime.state.root.tick,
        commandCountsByPlayerId: {}
      };
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
    const processedCommandIds = /* @__PURE__ */ new Set();
    const commandRateLimitWindow = {
      tick: state.root.tick,
      commandCountsByPlayerId: {}
    };
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
      snapshotController,
      processedCommandIds,
      commandRateLimitWindow
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
    stripClubConfig: runtime.config.balance.stripClub,
    restaurantConfig: runtime.config.balance.restaurant,
    convenienceStoreConfig: runtime.config.balance.convenienceStore,
    shoppingMallConfig: runtime.config.balance.shoppingMall,
    powerStationConfig: runtime.config.balance.powerStation,
    recruitmentCenterConfig: runtime.config.balance.recruitmentCenter,
    garageConfig: runtime.config.balance.garage,
    recyclingCenterConfig: runtime.config.balance.recyclingCenter,
    productionMultiplier: runtime.config.balance.productionMultiplier,
    tickRateMs: runtime.config.tickRateMs
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
  new TextEncoder();
  new TextDecoder();
  const createCommandIngress = (commandRouter) => ({
    submit: (command) => commandRouter.dispatch(command.serverInstanceId, command)
  });
  const createGameplaySliceJsonHandler = (transport, endpointBase = "/api/gameplay-slice") => ({
    handle: (request) => {
      if (request.method.toUpperCase() !== "POST") {
        return createErrorResponse(405, {
          code: "transport.method_not_allowed",
          message: "Gameplay slice endpoints require POST."
        });
      }
      const route = normalizeRoute(request.path, endpointBase);
      if (route === "load") {
        return {
          status: 200,
          body: transport.load(request.body)
        };
      }
      if (route === "submit") {
        return {
          status: 200,
          body: transport.submit(request.body)
        };
      }
      return createErrorResponse(404, {
        code: "transport.not_found",
        message: "Gameplay slice endpoint was not found."
      });
    }
  });
  const normalizeRoute = (path, endpointBase) => {
    const normalizedBase = endpointBase.replace(/\/+$/u, "");
    const normalizedPath = path.replace(/\/+$/u, "");
    if (normalizedPath === `${normalizedBase}/load`) {
      return "load";
    }
    if (normalizedPath === `${normalizedBase}/submit`) {
      return "submit";
    }
    return null;
  };
  const createErrorResponse = (status, error) => ({
    status,
    body: {
      accepted: false,
      readModel: null,
      errors: [error]
    }
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
    const gameplaySliceJsonHandler = createGameplaySliceJsonHandler(gameplaySliceTransport);
    const liveUpdateGateway = createLiveUpdateGateway();
    const tickOrchestrator = createTickOrchestrator(instanceManager);
    const snapshotOrchestrator = createSnapshotOrchestrator(instanceManager);
    const healthService = createInstanceHealthService(instanceManager);
    const adminMonitoring = createAdminMonitoringFacade(instanceManager, healthService);
    return {
      instanceManager,
      commandIngress,
      gameplaySliceTransport,
      gameplaySliceJsonHandler,
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
        const building2 = createSeedBuilding(
          options.instanceId,
          district,
          buildingTypeId,
          index,
          resolveSeedBuildingDisplayName(districtSeed, index)
        );
        const productionProfile = (_a2 = config.balance.productionBuildings) == null ? void 0 : _a2[building2.buildingTypeId];
        state.buildingsById[building2.id] = building2;
        if (building2 && productionProfile) {
          state.resourceStatesById[`resource:${building2.id}`] = createSeedBuildingResourceState(
            building2,
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
  const createSeedBuildingResourceState = (building2, resourceKey) => ({
    id: `resource:${building2.id}`,
    ownerType: "building",
    ownerId: building2.id,
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
    const buildings = mapDistrict.buildings.map((building2) => String(building2 || "").trim()).filter(Boolean);
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
