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
    },
    lastCommandStatus: null
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
  const htmlEscapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => htmlEscapeMap[character] ?? character);
  const escapeAttribute = (value) => escapeHtml(value);
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
    prefix = "Čekání ",
    readyLabel = "Připraveno"
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
        prefix: node.dataset.cooldownPrefix ?? "Čekání ",
        readyLabel: node.dataset.cooldownReadyLabel ?? "Ready"
      });
      node.dataset.cooldownState = endsAtMs > nowMs ? "cooling" : "ready";
    });
    return nodes.length;
  };
  const renderBuildingDetailPopup = (building) => {
    const zoneKey = toCssToken$1(building.zoneLabel);
    return [
      `<section class="district-building-popup district-building-popup--${zoneKey}" role="dialog" aria-label="${escapeAttribute(`Detail budovy ${building.label}`)}" data-building-zone="${escapeAttribute(zoneKey)}" data-building-popup-id="${escapeAttribute(building.buildingId)}">`,
      `<header class="district-building-popup__header">`,
      `<div>`,
      `<p class="district-building-popup__eyebrow">${escapeHtml(building.zoneLabel)} · ${escapeHtml(building.roleLabel)}</p>`,
      `<h5 class="district-building-popup__title">${escapeHtml(building.label)}</h5>`,
      `<p class="district-building-popup__type">${escapeHtml(building.typeLabel)}</p>`,
      `</div>`,
      `<span class="district-building-popup__badge">${escapeHtml(building.statusLabel)}</span>`,
      `</header>`,
      `<div class="district-building-popup__info-card">`,
      `<span class="district-building-popup__section-label">Info</span>`,
      `<p class="district-building-popup__info">${escapeHtml(building.info)}</p>`,
      building.phaseTooltip || building.phaseBadgeLabel ? [
        `<p class="district-building-popup__phase-effect">`,
        `<span class="district-building-popup__section-label">Efekt</span>`,
        renderPhaseBadge$1(building),
        building.phaseTooltip ? `<span>${escapeHtml(building.phaseTooltip)}</span>` : "",
        `</p>`
      ].join("") : "",
      building.passivePhaseEffectLabel || building.passivePhaseBadgeLabel ? [
        `<p class="district-building-popup__phase-effect">`,
        `<span class="district-building-popup__section-label">Efekt fáze</span>`,
        building.passivePhaseBadgeLabel ? `<span class="district-panel__phase-badge" title="${escapeAttribute(building.passivePhaseTooltip || building.passivePhaseBadgeLabel)}">${escapeHtml(building.passivePhaseBadgeLabel)}</span>` : "",
        building.passivePhaseEffectLabel ? `<span>${escapeHtml(building.passivePhaseEffectLabel)}</span>` : "",
        `</p>`
      ].join("") : "",
      `</div>`,
      `<p class="district-building-popup__section-label">Statistiky</p>`,
      `<div class="district-building-popup__stats">`,
      building.stats.map((stat) => [
        `<span class="district-building-popup__stat">`,
        `<span class="district-building-popup__stat-label">${escapeHtml(stat.label)}</span>`,
        `<strong class="district-building-popup__stat-value">${escapeHtml(stat.value)}</strong>`,
        `</span>`
      ].join("")).join(""),
      `</div>`,
      `<div class="district-building-popup__actions">`,
      `<div class="district-building-popup__actions-head">`,
      `<p class="district-building-popup__section-label">Speciální akce</p>`,
      `<span class="district-building-popup__count">${escapeHtml(building.specialActions.length)}</span>`,
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
    const reasonAttribute = action.disabledReason ? ` data-disabled-reason="${escapeAttribute(action.disabledReason)}"` : "";
    return [
      `<article class="district-building-popup__action${action.disabled ? " is-disabled" : ""}" data-special-action-id="${escapeAttribute(action.actionId)}">`,
      `<span class="district-building-popup__action-light" aria-hidden="true"></span>`,
      `<div class="district-building-popup__action-copy">`,
      `<div class="district-building-popup__action-state-row">`,
      `<span class="district-building-popup__action-state">${action.disabled ? "Blokováno" : "Připraveno"}</span>`,
      renderPhaseBadge$1(action),
      `</div>`,
      `<strong>${escapeHtml(action.label)}</strong>`,
      `<span>${escapeHtml(action.description)}</span>`,
      renderPhaseEffectLine$1(action),
      `<div class="district-building-popup__action-metrics">`,
      `<small>${escapeHtml(action.effectSummary)}</small>`,
      `<small>Cena teď ${escapeHtml(action.inputSummary)}</small>`,
      `<small>Zisk teď ${escapeHtml(action.outputSummary)}</small>`,
      `<small>CD ${renderLiveCooldown$1(action)}</small>`,
      `<small>${escapeHtml(action.durationLabel)}</small>`,
      `<small>Heat teď ${escapeHtml(action.heatLabel)}</small>`,
      `</div>`,
      `</div>`,
      `<button class="district-panel__action-button district-panel__action-button--craft district-building-popup__run-button" data-building-action-building-id="${escapeAttribute(building.buildingId)}" data-building-action-id="${escapeAttribute(action.actionId)}"${disabledAttribute}${reasonAttribute}>Spustit</button>`,
      action.disabledReason ? `<p class="district-panel__action-reason">${escapeHtml(action.disabledReason)}</p>` : "",
      `</article>`
    ].join("");
  };
  const toCssToken$1 = (value) => String(value || "building").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "building";
  const renderLiveCooldown$1 = (action) => action.cooldownEndsAtMs && action.cooldownRemainingMs > 0 ? [
    `<span data-live-cooldown="true"`,
    ` data-cooldown-ends-at-ms="${escapeAttribute(action.cooldownEndsAtMs)}"`,
    ` data-cooldown-prefix=""`,
    ` data-cooldown-ready-label="Připraveno po synchronizaci">`,
    escapeHtml(action.cooldownLabel.replace(/^(?:Cooldown|Čekání)\s+/u, "")),
    `</span>`
  ].join("") : escapeHtml(action.cooldownLabel);
  const renderPhaseBadge$1 = (action) => {
    if (!action.phaseBadgeLabel) return "";
    const availability = toCssToken$1(action.phaseAvailability || "neutral");
    const tooltip = action.phaseTooltip || action.phaseBadgeLabel;
    return `<span class="district-panel__phase-badge district-panel__phase-badge--${escapeAttribute(availability)}" title="${escapeAttribute(tooltip)}">${escapeHtml(action.phaseBadgeLabel)}</span>`;
  };
  const renderPhaseEffectLine$1 = (action) => action.phaseEffectLabel ? `<p class="district-building-popup__phase-effect district-building-popup__phase-effect--action"><span class="district-building-popup__section-label">Efekt fáze</span><span>${escapeHtml(action.phaseEffectLabel)}</span></p>` : "";
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
  const renderBuildingSlot = (slot) => {
    const buildingType = toCssToken(slot.buildingTypeId || "empty");
    const hasProduction = Boolean(slot.production);
    const hasCraft = slot.craftOptions.length > 0;
    return [
      `<section class="district-panel__slot district-panel__slot--${buildingType}" data-slot-index="${escapeAttribute(slot.slotIndex)}" data-slot-status="${escapeAttribute(slot.statusLabel)}" data-slot-building-type="${escapeAttribute(buildingType)}" data-has-production="${escapeAttribute(hasProduction)}" data-has-craft="${escapeAttribute(hasCraft)}">`,
      `<div class="district-panel__slot-head">`,
      `<div class="district-panel__slot-heading">`,
      `<span class="district-panel__slot-icon" aria-hidden="true">${getBuildingIcon(slot.buildingTypeId)}</span>`,
      `<div>`,
      `<p class="district-panel__slot-index">Slot ${escapeHtml(slot.slotIndex + 1)}</p>`,
      `<h4 class="district-panel__slot-title">${escapeHtml(slot.title)}</h4>`,
      `</div>`,
      `</div>`,
      `<span class="district-panel__slot-state">${escapeHtml(slot.statusLabel)}</span>`,
      `</div>`,
      `<p class="district-panel__slot-summary">${escapeHtml(slot.summaryLabel)}</p>`,
      slot.production ? [
        `<div class="district-panel__production district-panel__production--storage">`,
        `<div class="district-panel__production-head">`,
        `<strong class="district-panel__production-title">${escapeHtml(slot.production.resourceLabel)}</strong>`,
        `<span class="district-panel__production-rate">${escapeHtml(slot.production.rateLabel)}</span>`,
        `</div>`,
        `<div class="district-panel__production-bar" style="--production-fill:${escapeAttribute(toPercentCssValue(slot.production.storagePercent))}%">`,
        `<span class="district-panel__production-bar-fill"></span>`,
        `</div>`,
        `<div class="district-panel__production-metrics">`,
        `<span class="district-panel__production-metric">${escapeHtml(slot.production.storageLabel)}</span>`,
        `<span class="district-panel__production-metric">${escapeHtml(slot.production.playerStockLabel)}</span>`,
        `</div>`,
        `<div class="district-panel__action-row">`,
        `<button class="district-panel__action-button district-panel__action-button--collect" data-collect-building-id="${escapeAttribute(slot.production.buildingId)}"${slot.production.canCollect ? "" : " disabled"}${slot.production.collectDisabledReason ? ` data-disabled-reason="${escapeAttribute(slot.production.collectDisabledReason)}"` : ""}>Vybrat ${escapeHtml(slot.production.resourceLabel)}</button>`,
        slot.production.collectDisabledReason ? `<p class="district-panel__action-reason">${escapeHtml(slot.production.collectDisabledReason)}</p>` : "",
        `</div>`,
        `</div>`
      ].join("") : "",
      slot.craftOptions.length > 0 ? [
        `<div class="district-panel__production district-panel__production--craft">`,
        `<div class="district-panel__production-head">`,
        `<strong class="district-panel__production-title">Zpracování</strong>`,
        `<span class="district-panel__production-rate">${escapeHtml(slot.craftOptions.length)} receptů</span>`,
        `</div>`,
        slot.processing ? [
          `<div class="district-panel__production-metrics">`,
          `<span class="district-panel__production-metric">Zpracovává se ${escapeHtml(slot.processing.label)}</span>`,
          `<span class="district-panel__production-metric">${escapeHtml(slot.processing.progressLabel)}</span>`,
          `<span class="district-panel__production-metric">${escapeHtml(slot.processing.completionLabel)}</span>`,
          `</div>`,
          `<div class="district-panel__production-metrics">`,
          `<span class="district-panel__production-metric">${escapeHtml(slot.processing.outputLabel)}</span>`,
          `</div>`
        ].join("") : "",
        slot.craftOptions.map(
          (option) => [
            `<article class="district-panel__craft-option" data-craft-option="${escapeAttribute(option.recipeId)}">`,
            `<div class="district-panel__production-metrics">`,
            `<span class="district-panel__production-metric">Cena ${escapeHtml(option.inputSummary)}</span>`,
            `<span class="district-panel__production-metric">+${escapeHtml(option.outputAmount)} ${escapeHtml(option.outputResourceLabel)}</span>`,
            `<span class="district-panel__production-metric">${escapeHtml(option.playerStockLabel)}</span>`,
            `</div>`,
            `<div class="district-panel__action-row">`,
            `<button class="district-panel__action-button district-panel__action-button--craft" data-craft-building-id="${escapeAttribute(option.buildingId)}" data-craft-recipe-id="${escapeAttribute(option.recipeId)}"${option.canCraft ? "" : " disabled"}${option.disabledReason ? ` data-disabled-reason="${escapeAttribute(option.disabledReason)}"` : ""}>Zpracovat ${escapeHtml(option.label)}</button>`,
            option.disabledReason ? `<p class="district-panel__action-reason">${escapeHtml(option.disabledReason)}</p>` : "",
            `</div>`,
            `</article>`
          ].join("")
        ).join(""),
        `</div>`
      ].join("") : "",
      slot.production || slot.craftOptions.length > 0 ? "" : `<p class="district-panel__empty-copy">Pevné budovy pro tento distrikt určuje mapa.</p>`,
      "</section>"
    ].join("");
  };
  const renderDistrictBuilding = (building, isOpen = false) => [
    `<article class="district-panel__slot district-panel__slot--${toCssToken(building.buildingTypeId)}" data-building-id="${escapeAttribute(building.buildingId)}" data-building-type="${escapeAttribute(building.buildingTypeId)}">`,
    `<div class="district-panel__slot-head">`,
    `<div class="district-panel__slot-heading">`,
    `<span class="district-panel__slot-icon" aria-hidden="true">${getBuildingIcon(building.buildingTypeId)}</span>`,
    `<div>`,
    `<p class="district-panel__slot-index">${escapeHtml(building.typeLabel)}</p>`,
    `<h4 class="district-panel__slot-title">${escapeHtml(building.label)}</h4>`,
    `</div>`,
    `</div>`,
    `<span class="district-panel__slot-state">${escapeHtml(building.statusLabel)}</span>`,
    `</div>`,
    `<p class="district-panel__slot-summary">${escapeHtml(building.summaryLabel)}</p>`,
    `<details class="district-building-popup-host" data-building-popup-target="${escapeAttribute(building.buildingId)}"${isOpen ? " open" : ""}>`,
    `<summary class="district-panel__action-button district-panel__action-button--info">Statistiky / Info / Speciální akce</summary>`,
    renderBuildingDetailPopup(building),
    `</details>`,
    building.actions.length > 0 ? building.actions.map((action) => {
      const disabledAttribute = action.disabled ? " disabled" : "";
      const reasonAttribute = action.disabledReason ? ` data-disabled-reason="${escapeAttribute(action.disabledReason)}"` : "";
      return [
        `<div class="district-panel__production" data-building-action-controls="${escapeAttribute(action.actionId)}">`,
        `<div class="district-panel__production-head">`,
        `<div class="district-panel__production-title-row">`,
        `<strong class="district-panel__production-title">${escapeHtml(action.label)}</strong>`,
        renderPhaseBadge(action),
        `</div>`,
        `<span class="district-panel__production-rate">${escapeHtml(action.statusLabel)} · ${renderLiveCooldown(action)}</span>`,
        `</div>`,
        `<p class="district-panel__slot-summary">${escapeHtml(action.description)}</p>`,
        action.expectedEffectSummary.length > 0 ? `<p class="district-panel__slot-summary">${action.expectedEffectSummary.map(escapeHtml).join(" · ")}</p>` : "",
        renderPhaseEffectLine(action),
        `<div class="district-panel__production-metrics">`,
        `<span class="district-panel__production-metric">Cena teď ${escapeHtml(action.inputSummary)}</span>`,
        `<span class="district-panel__production-metric">Zisk teď ${escapeHtml(action.outputSummary)}</span>`,
        `<span class="district-panel__production-metric">Heat teď ${escapeHtml(action.heatLabel)}</span>`,
        `<span class="district-panel__production-metric">Vliv ${escapeHtml(action.influenceLabel)}</span>`,
        `</div>`,
        action.riskSummary.length > 0 ? `<div class="district-panel__production-metrics">${action.riskSummary.map((entry) => `<span class="district-panel__production-metric">${escapeHtml(entry)}</span>`).join("")}</div>` : "",
        `<div class="district-panel__action-row">`,
        renderBuildingActionInputs(action),
        `<button class="district-panel__action-button district-panel__action-button--craft" data-building-action-building-id="${escapeAttribute(building.buildingId)}" data-building-action-id="${escapeAttribute(action.actionId)}"${disabledAttribute}${reasonAttribute}>${escapeHtml(action.label)}</button>`,
        action.disabledReason ? `<p class="district-panel__action-reason">${escapeHtml(action.disabledReason)}</p>` : "",
        `</div>`,
        `</div>`
      ].join("");
    }).join("") : `<p class="district-panel__empty-copy">Pro tuto pevnou budovu nejsou dostupné serverové akce.</p>`,
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
  const renderBuildingActionInputs = (action) => action.inputs.map((input) => {
    const dataAttribute = `data-building-action-input="${escapeAttribute(input.id)}"`;
    const dealerAttribute = input.id === "dealerSlotId" ? " data-dealer-slot-input" : input.id === "itemId" ? " data-dealer-item-input" : input.id === "amount" ? " data-dealer-amount-input" : "";
    if (input.type === "select") {
      return [
        `<select class="district-panel__action-select" ${dataAttribute}${dealerAttribute} aria-label="${escapeAttribute(input.label)}">`,
        input.options.map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`).join(""),
        `</select>`
      ].join("");
    }
    return `<input class="district-panel__action-input" ${dataAttribute}${dealerAttribute} aria-label="${escapeAttribute(input.label)}" type="${escapeAttribute(input.type)}"${input.min !== void 0 ? ` min="${escapeAttribute(input.min)}"` : ""}${input.max !== void 0 ? ` max="${escapeAttribute(input.max)}"` : ""}${input.required ? " required" : ""}${input.type === "number" ? ' value="1"' : ""}>`;
  }).join("");
  const toCssToken = (value) => String(value || "building").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "building";
  const toPercentCssValue = (value) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const renderLiveCooldown = (action) => action.cooldownEndsAtMs && action.cooldownRemainingMs > 0 ? [
    `<span data-live-cooldown="true"`,
    ` data-cooldown-ends-at-ms="${escapeAttribute(action.cooldownEndsAtMs)}"`,
    ` data-cooldown-prefix="Čekání "`,
    ` data-cooldown-ready-label="Připraveno po synchronizaci">`,
    escapeHtml(action.cooldownLabel),
    `</span>`
  ].join("") : escapeHtml(action.cooldownLabel);
  const renderPhaseBadge = (action) => {
    if (!action.phaseBadgeLabel) return "";
    const availability = toCssToken(action.phaseAvailability || "neutral");
    const tooltip = action.phaseTooltip || action.phaseBadgeLabel;
    return `<span class="district-panel__phase-badge district-panel__phase-badge--${escapeAttribute(availability)}" title="${escapeAttribute(tooltip)}">${escapeHtml(action.phaseBadgeLabel)}</span>`;
  };
  const renderPhaseEffectLine = (action) => action.phaseEffectLabel ? `<p class="district-panel__phase-effect-row"><span>Efekt fáze</span> ${escapeHtml(action.phaseEffectLabel)}</p>` : "";
  const createAttackDistrictCommand = (input) => {
    const district = input.slice.district;
    if (!district) {
      throw new Error("Attack command cannot be created from missing district/target context.");
    }
    return {
      id: input.commandId,
      type: "attack-district",
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
  const DEFAULT_DEFENSE_ITEM_ID = "barricades";
  const DEFAULT_DEFENSE_AMOUNT = 1;
  const createPlaceDefenseCommand = (input) => {
    const district = input.slice.district;
    if (!district || !district.placeDefense) {
      throw new Error("Place defense command cannot be created from missing district/defense context.");
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
        defenseItemId: DEFAULT_DEFENSE_ITEM_ID,
        amount: DEFAULT_DEFENSE_AMOUNT,
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
    return {
      id: input.commandId,
      type: "remove-defense",
      mode: input.slice.mode.mode,
      playerId: input.slice.player.playerId,
      serverInstanceId: input.slice.player.instanceId,
      issuedAt: input.issuedAt,
      payload: {
        targetDistrictId: district.districtId,
        defenseItemId: DEFAULT_DEFENSE_ITEM_ID,
        amount: DEFAULT_DEFENSE_AMOUNT,
        expectedTargetVersion: district.removeDefense.expectedTargetVersion
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createHeistDistrictCommand = (input) => {
    var _a;
    const district = input.slice.district;
    const target = (_a = district == null ? void 0 : district.heistTargets) == null ? void 0 : _a.find((entry) => entry.districtId === input.targetDistrictId);
    const styleFallback = { style: "balanced", defaultGangMembersSent: 1 };
    const style = (target == null ? void 0 : target.styles.find((entry) => entry.style === "balanced")) ?? (target == null ? void 0 : target.styles[0]) ?? styleFallback;
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
        sourceDistrictId: district.districtId,
        style: style.style,
        gangMembersSent: style.defaultGangMembersSent,
        ...(target == null ? void 0 : target.expectedTargetVersion) !== void 0 ? { expectedTargetVersion: target.expectedTargetVersion } : {},
        ...(target == null ? void 0 : target.expectedSourceVersion) !== void 0 ? { expectedSourceVersion: target.expectedSourceVersion } : {}
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createOccupyDistrictCommand = (input) => {
    const district = input.slice.district;
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
        sourceDistrictId: district.districtId
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createRobDistrictCommand = (input) => {
    var _a;
    const district = input.slice.district;
    const target = (_a = district == null ? void 0 : district.robTargets) == null ? void 0 : _a.find((entry) => entry.districtId === input.targetDistrictId);
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
        sourceDistrictId: district.districtId,
        ...(target == null ? void 0 : target.expectedTargetVersion) !== void 0 ? { expectedTargetVersion: target.expectedTargetVersion } : {},
        ...(target == null ? void 0 : target.expectedSourceVersion) !== void 0 ? { expectedSourceVersion: target.expectedSourceVersion } : {}
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
    const district = input.slice.district;
    if (!district) {
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
        sourceDistrictId: district.districtId
      },
      clientRequestId: input.clientRequestId ?? null
    };
  };
  const createPlaceTrapCommand = (input) => {
    const district = input.slice.district;
    if (!(district == null ? void 0 : district.trap)) {
      throw new Error("Trap command cannot be created from missing district/trap context.");
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
  const renderBasicDistrictActionSections = (panel) => [
    renderTargetSection({
      attribute: "data-rob-targets",
      title: "Cíle loupeže",
      copy: "Vykradení neutrálního souseda potvrzuje server.",
      emptyCopy: "Z tohoto distriktu není dostupný neutrální cíl loupeže.",
      targetAttribute: "data-rob-target-id",
      buttonModifier: "rob",
      targets: panel.robTargets,
      renderMeta: (target) => target.statusLabel
    }),
    renderTargetSection({
      attribute: "data-heist-targets",
      title: "Cíle heistu",
      copy: "Okamžitý alpha heist krade zdroje bez převzetí území. Výsledek počítá server.",
      emptyCopy: "Z tohoto distriktu není dostupný nepřátelský cíl heistu.",
      targetAttribute: "data-heist-target-id",
      buttonModifier: "heist",
      targets: panel.heistTargets,
      renderMeta: (target) => `${target.ownerLabel} · ${target.statusLabel}`
    }),
    renderDefenseSection(panel.placeDefense, panel.removeDefense)
  ].join("");
  const renderTargetSection = (input) => [
    `<section class="district-panel__section" ${input.attribute}="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">${escapeHtml(input.title)}</h3>`,
    `<p class="district-panel__section-copy">${escapeHtml(input.copy)}</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(input.targets.length)} celkem</span>`,
    `</div>`,
    input.targets.length > 0 ? input.targets.map((target) => renderTargetRow(input, target)).join("") : `<p class="district-panel__empty-copy">${escapeHtml(input.emptyCopy)}</p>`,
    `</section>`
  ].join("");
  const renderTargetRow = (input, target) => {
    const disabledAttribute = target.disabled ? " disabled" : "";
    const reasonAttribute = target.disabledReason ? ` data-disabled-reason="${escapeAttribute(target.disabledReason)}"` : "";
    return [
      `<div class="district-panel__action-row">`,
      `<button class="district-panel__action-button district-panel__action-button--${escapeAttribute(input.buttonModifier)}" ${input.targetAttribute}="${escapeAttribute(target.districtId)}"${disabledAttribute}${reasonAttribute}>`,
      `<span class="district-panel__action-title">${escapeHtml(target.label)}</span>`,
      `<span class="district-panel__action-meta">${escapeHtml(input.renderMeta(target))}</span>`,
      target.cooldownLabel ? `<span class="district-panel__action-meta">${escapeHtml(`Čekání ${target.cooldownLabel}`)}</span>` : "",
      `</button>`,
      target.disabledReason ? `<p class="district-panel__action-reason">${escapeHtml(target.disabledReason)}</p>` : "",
      `</div>`
    ].join("");
  };
  const renderDefenseSection = (placeDefense, removeDefense) => placeDefense || removeDefense ? [
    `<section class="district-panel__section" data-defense-actions="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Obrana</h3>`,
    `<p class="district-panel__section-copy">Obranu ve vlastním distriktu mění jen serverový command.</p>`,
    `</div>`,
    `</div>`,
    placeDefense ? renderDefenseButton("data-place-defense", placeDefense) : "",
    removeDefense ? renderDefenseButton("data-remove-defense", removeDefense) : "",
    `</section>`
  ].join("") : "";
  const renderDefenseButton = (attribute, action) => [
    `<div class="district-panel__action-row">`,
    `<button class="district-panel__action-button district-panel__action-button--defense" ${attribute}="true"${action.disabled ? " disabled" : ""}>${escapeHtml(action.actionLabel)}</button>`,
    action.disabledReason ? `<p class="district-panel__action-reason">${escapeHtml(action.disabledReason)}</p>` : "",
    `</div>`
  ].join("");
  const districtPanelFeature = "district-panel";
  const renderDistrictPanel = (panel) => panel.statusLabel === "destroyed" ? [
    `<section class="district-destroyed-notice" data-feature="district-destroyed-notice" data-district-id="${escapeAttribute(panel.districtId)}" data-district-destroyed="true" role="status" aria-label="Zničený distrikt">`,
    `<p>V piči, zničen.</p>`,
    `</section>`
  ].join("") : [
    `<section class="district-panel" data-feature="${districtPanelFeature}" data-district-id="${escapeAttribute(panel.districtId)}">`,
    `<header class="district-panel__header">`,
    `<p class="district-panel__eyebrow">Panel distriktu</p>`,
    `<h2 class="district-panel__title">${escapeHtml(panel.title)}</h2>`,
    `<div class="district-panel__badges">`,
    `<span class="district-panel__badge district-panel__badge--owner">${escapeHtml(panel.ownershipLabel)}</span>`,
    `<span class="district-panel__badge district-panel__badge--status">${escapeHtml(panel.statusLabel)}</span>`,
    panel.hasPendingCommand ? `<span class="district-panel__badge district-panel__badge--pending">Akce se zpracovává</span>` : "",
    `</div>`,
    `</header>`,
    `<section class="district-panel__summary-grid" aria-label="Přehled distriktu">`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Vlastnictví</span><strong class="district-panel__summary-value">${escapeHtml(panel.ownershipLabel)}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Zóna</span><strong class="district-panel__summary-value">${escapeHtml(panel.zoneLabel)}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Hledanost</span><strong class="district-panel__summary-value">${escapeHtml(panel.heatLabel)}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Vliv</span><strong class="district-panel__summary-value">${escapeHtml(panel.influenceLabel)}</strong></article>`,
    `<article class="district-panel__summary-card"><span class="district-panel__summary-label">Budovy</span><strong class="district-panel__summary-value">${escapeHtml(panel.buildingSummary)}</strong></article>`,
    `</section>`,
    panel.trap ? [
      `<section class="district-panel__section" data-trap-action="true">`,
      `<div class="district-panel__section-head">`,
      `<div>`,
      `<h3 class="district-panel__section-title">Past</h3>`,
      `<p class="district-panel__section-copy">Nastraž jednu skrytou past ve vlastním distriktu. Nepřátelé ji zjistí jen přes reporty.</p>`,
      `</div>`,
      `<span class="district-panel__section-meta">${panel.trap.activeLabel ? "Nastraženo" : "Připraveno"}</span>`,
      `</div>`,
      `<div class="district-panel__action-row">`,
      `<button class="district-panel__action-button district-panel__action-button--trap" data-place-trap="true"${panel.trap.disabled ? " disabled" : ""}${panel.trap.disabledReason ? ` data-disabled-reason="${escapeAttribute(panel.trap.disabledReason)}"` : ""}>${escapeHtml(panel.trap.actionLabel)}</button>`,
      panel.trap.disabledReason ? `<p class="district-panel__action-reason">${escapeHtml(panel.trap.disabledReason)}</p>` : panel.trap.activeLabel ? `<p class="district-panel__action-reason">${escapeHtml(panel.trap.activeLabel)}</p>` : "",
      `</div>`,
      `</section>`
    ].join("") : "",
    `<section class="district-panel__section" data-spy-targets="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Cíle špehování</h3>`,
    `<p class="district-panel__section-copy">Vyšli průzkum z tohoto distriktu. Reporty potvrzuje server.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(panel.spyTargets.length)} celkem</span>`,
    `</div>`,
    panel.spyTargets.length > 0 ? panel.spyTargets.map((target) => {
      const disabledAttribute = target.disabled ? " disabled" : "";
      const reasonAttribute = target.disabledReason ? ` data-disabled-reason="${escapeAttribute(target.disabledReason)}"` : "";
      return [
        `<div class="district-panel__action-row">`,
        `<button class="district-panel__action-button district-panel__action-button--spy" data-spy-target-id="${escapeAttribute(target.districtId)}"${disabledAttribute}${reasonAttribute}>`,
        `<span class="district-panel__action-title">${escapeHtml(target.label)}</span>`,
        `<span class="district-panel__action-meta">${escapeHtml(target.ownerLabel)} · ${escapeHtml(target.statusLabel)}</span>`,
        `</button>`,
        target.disabledReason ? `<p class="district-panel__action-reason">${escapeHtml(target.disabledReason)}</p>` : "",
        `</div>`
      ].join("");
    }).join("") : `<p class="district-panel__empty-copy">Z tohoto distriktu není dostupný cíl špehování.</p>`,
    `</section>`,
    `<section class="district-panel__section" data-occupy-targets="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Cíle obsazení</h3>`,
    `<p class="district-panel__section-copy">Neutrální sousedy obsazuj až po serverem potvrzeném průzkumu.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(panel.occupyTargets.length)} celkem</span>`,
    `</div>`,
    panel.occupyTargets.length > 0 ? panel.occupyTargets.map((target) => {
      const disabledAttribute = target.disabled ? " disabled" : "";
      const reasonAttribute = target.disabledReason ? ` data-disabled-reason="${escapeAttribute(target.disabledReason)}"` : "";
      return [
        `<div class="district-panel__action-row">`,
        `<button class="district-panel__action-button district-panel__action-button--occupy" data-occupy-target-id="${escapeAttribute(target.districtId)}"${disabledAttribute}${reasonAttribute}>`,
        `<span class="district-panel__action-title">${escapeHtml(target.label)}</span>`,
        `<span class="district-panel__action-meta">${escapeHtml(target.statusLabel)} · cena ${escapeHtml(target.influenceCostLabel)} · hledanost ${escapeHtml(target.heatGainLabel)}</span>`,
        `</button>`,
        target.disabledReason ? `<p class="district-panel__action-reason">${escapeHtml(target.disabledReason)}</p>` : "",
        `</div>`
      ].join("");
    }).join("") : `<p class="district-panel__empty-copy">Z tohoto distriktu není dostupný neutrální cíl obsazení.</p>`,
    `</section>`,
    renderBasicDistrictActionSections(panel),
    `<section class="district-panel__section" data-attack-targets="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Cíle útoku</h3>`,
    `<p class="district-panel__section-copy">Vyber sousední distrikt pro útok.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(panel.attackTargets.length)} celkem</span>`,
    `</div>`,
    panel.attackTargets.length > 0 ? panel.attackTargets.map((target) => {
      const disabledAttribute = target.disabled ? " disabled" : "";
      const reasonAttribute = target.disabledReason ? ` data-disabled-reason="${escapeAttribute(target.disabledReason)}"` : "";
      return [
        `<div class="district-panel__action-row">`,
        `<button class="district-panel__action-button district-panel__action-button--attack" data-attack-target-id="${escapeAttribute(target.districtId)}"${disabledAttribute}${reasonAttribute}>`,
        `<span class="district-panel__action-title">${escapeHtml(target.label)}</span>`,
        `<span class="district-panel__action-meta">${escapeHtml(target.ownerLabel)} · ${escapeHtml(target.statusLabel)}${target.cooldownLabel ? ` · čekání ${escapeHtml(target.cooldownLabel)}` : ""}</span>`,
        `</button>`,
        target.disabledReason ? `<p class="district-panel__action-reason">${escapeHtml(target.disabledReason)}</p>` : "",
        `</div>`
      ].join("");
    }).join("") : `<p class="district-panel__empty-copy">Z tohoto distriktu není dostupný cíl útoku.</p>`,
    `</section>`,
    `<section class="district-panel__section">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">Budovy distriktu</h3>`,
    `<p class="district-panel__section-copy">Budovy jsou pevně dané mapou distriktu. Akce z budov potvrzuje server.</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(panel.buildings.length)} pevně daných</span>`,
    `</div>`,
    `<div class="district-panel__slot-list">`,
    panel.buildings.length > 0 ? panel.buildings.map((building) => renderDistrictBuilding(building, building.buildingId === panel.selectedBuildingId)).join("") : `<p class="district-panel__empty-copy">Tento distrikt nemá v projekci žádné pevné budovy.</p>`,
    `</div>`,
    `</section>`,
    panel.slots.some((slot) => slot.production || slot.craftOptions.length > 0) ? [
      `<section class="district-panel__section" data-production-slots="true">`,
      `<div class="district-panel__section-head">`,
      `<div>`,
      `<h3 class="district-panel__section-title">Produkční sloty</h3>`,
      `<p class="district-panel__section-copy">Pevné produkční budovy tady ukazují sklady, zpracování a recepty.</p>`,
      `</div>`,
      `<span class="district-panel__section-meta">${escapeHtml(panel.slots.filter((slot) => slot.production || slot.craftOptions.length > 0).length)} aktivních</span>`,
      `</div>`,
      `<div class="district-panel__slot-list district-panel__slot-list--production">`,
      panel.slots.filter((slot) => slot.production || slot.craftOptions.length > 0).map((slot) => renderBuildingSlot(slot)).join(""),
      `</div>`,
      `</section>`
    ].join("") : "",
    "</section>"
  ].join("");
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
      return { kind: "collect", buildingId: collectButton.dataset.collectBuildingId };
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
        recipeId: craftButton.dataset.craftRecipeId
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
  const overlayStack = [];
  const LOCKED_BODY_DATA_ATTRIBUTE = "overlayScrollLocked";
  const LOCKED_BODY_CLASS = "game-modal-scroll-locked";
  const DEFAULT_GHOST_CLICK_SUPPRESSION_MS = 250;
  const MODAL_SCROLL_LOCK_OWNER = Symbol("modal-scroll-lock-compat");
  const MOBILE_SCROLL_LOCK_MEDIA = "(max-width: 720px), (hover: none) and (pointer: coarse), (any-hover: none), (any-pointer: coarse)";
  let suppressMapInputUntil = 0;
  let lockedPageScroll = null;
  let lockedBodyStyles = null;
  let lockedRootStyles = null;
  const getBody = () => {
    if (typeof document === "undefined") {
      return null;
    }
    return document.body;
  };
  const getScrollPosition = () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return { x: 0, y: 0 };
    }
    return {
      x: Math.max(0, Math.floor(window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0)),
      y: Math.max(0, Math.floor(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0))
    };
  };
  const restorePageScroll = (scrollPosition) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const scrollX = Math.max(0, Math.floor(scrollPosition.x || 0));
    const scrollY = Math.max(0, Math.floor(scrollPosition.y || 0));
    document.documentElement.scrollLeft = scrollX;
    document.documentElement.scrollTop = scrollY;
    document.body.scrollLeft = scrollX;
    document.body.scrollTop = scrollY;
    try {
      window.scrollTo({ top: scrollY, left: scrollX, behavior: "auto" });
    } catch {
      window.scrollTo(scrollX, scrollY);
    }
    if (Math.abs(getScrollPosition().y - scrollY) > 1) {
      try {
        window.scrollTo(scrollX, scrollY);
      } catch {
      }
    }
  };
  const schedulePageScrollRestore = (scrollPosition) => {
    var _a, _b;
    const restore = () => restorePageScroll(scrollPosition);
    restore();
    (_a = window.requestAnimationFrame) == null ? void 0 : _a.call(window, restore);
    (_b = window.setTimeout) == null ? void 0 : _b.call(window, restore, 80);
  };
  const shouldUseViewportWidthLock = () => {
    var _a;
    if (typeof window === "undefined") {
      return false;
    }
    return Boolean((_a = window.matchMedia) == null ? void 0 : _a.call(window, MOBILE_SCROLL_LOCK_MEDIA).matches);
  };
  const getCurrentLayoutLockWidth = (body, root) => {
    var _a, _b;
    return Math.max(
      0,
      Math.ceil(
        ((_a = body.getBoundingClientRect) == null ? void 0 : _a.call(body).width) || body.offsetWidth || root.clientWidth || ((_b = window.visualViewport) == null ? void 0 : _b.width) || window.innerWidth || 0
      )
    );
  };
  const lockBodyScroll = () => {
    var _a;
    const body = getBody();
    if (!body || typeof window === "undefined") {
      return;
    }
    if (body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] === "true") {
      return;
    }
    const root = document.documentElement;
    const scrollPosition = getScrollPosition();
    const bodyComputed = (_a = window.getComputedStyle) == null ? void 0 : _a.call(window, body);
    const isViewportWidthScrollLock = shouldUseViewportWidthLock();
    const lockedLayoutWidth = isViewportWidthScrollLock ? getCurrentLayoutLockWidth(body, root) : 0;
    const scrollbarWidth = Math.max(0, Math.floor((window.innerWidth || root.clientWidth || 0) - (root.clientWidth || 0)));
    const currentPaddingRight = Number.parseFloat((bodyComputed == null ? void 0 : bodyComputed.paddingRight) || "0") || 0;
    lockedPageScroll = scrollPosition;
    lockedBodyStyles = {
      left: body.style.left,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      paddingRight: body.style.paddingRight,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
      width: body.style.width
    };
    lockedRootStyles = {
      overflow: root.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior,
      scrollbarGutter: root.style.getPropertyValue("scrollbar-gutter")
    };
    root.classList.add(LOCKED_BODY_CLASS);
    body.classList.add(LOCKED_BODY_CLASS);
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    if (!isViewportWidthScrollLock) {
      root.style.setProperty("scrollbar-gutter", "stable");
    }
    body.style.position = "fixed";
    body.style.top = `-${scrollPosition.y}px`;
    body.style.left = `-${scrollPosition.x}px`;
    body.style.right = "0";
    body.style.width = isViewportWidthScrollLock && lockedLayoutWidth > 0 ? `${lockedLayoutWidth}px` : "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    if (!isViewportWidthScrollLock && scrollbarWidth > 0) {
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
    body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] = "true";
  };
  const unlockBodyScroll = () => {
    const body = getBody();
    if (!body || typeof window === "undefined") {
      return;
    }
    if (body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] !== "true") {
      return;
    }
    const root = document.documentElement;
    const scrollPosition = lockedPageScroll ?? getScrollPosition();
    if (lockedRootStyles) {
      root.style.overflow = lockedRootStyles.overflow;
      root.style.overscrollBehavior = lockedRootStyles.overscrollBehavior;
      if (lockedRootStyles.scrollbarGutter) {
        root.style.setProperty("scrollbar-gutter", lockedRootStyles.scrollbarGutter);
      } else {
        root.style.removeProperty("scrollbar-gutter");
      }
    }
    if (lockedBodyStyles) {
      Object.assign(body.style, lockedBodyStyles);
    }
    root.classList.remove(LOCKED_BODY_CLASS);
    body.classList.remove(LOCKED_BODY_CLASS);
    body.dataset[LOCKED_BODY_DATA_ATTRIBUTE] = "";
    delete body.dataset[LOCKED_BODY_DATA_ATTRIBUTE];
    lockedPageScroll = null;
    lockedBodyStyles = null;
    lockedRootStyles = null;
    schedulePageScrollRestore(scrollPosition);
  };
  const now = () => {
    var _a;
    return typeof window !== "undefined" && ((_a = window.performance) == null ? void 0 : _a.now) ? window.performance.now() : Date.now();
  };
  const suppressMapInputFor = (ms = DEFAULT_GHOST_CLICK_SUPPRESSION_MS) => {
    suppressMapInputUntil = Math.max(suppressMapInputUntil, now() + ms);
  };
  const shouldSuppressMapInput = (event) => {
    const suppressed = isOverlayOpen() || now() < suppressMapInputUntil;
    if (suppressed) {
      event == null ? void 0 : event.preventDefault();
      event == null ? void 0 : event.stopPropagation();
      event == null ? void 0 : event.stopImmediatePropagation();
    }
    return suppressed;
  };
  const hasScrollLockingOverlay = () => overlayStack.some((entry) => entry.lockScroll);
  const openOverlayEntry = (type, owner, options = {}) => {
    const entry = {
      lockScroll: options.lockScroll !== false,
      type,
      owner
    };
    if (entry.lockScroll && !hasScrollLockingOverlay()) {
      lockBodyScroll();
    }
    overlayStack.push(entry);
  };
  const findOverlayEntryIndexByOwner = (owner) => {
    var _a;
    for (let index = overlayStack.length - 1; index >= 0; index -= 1) {
      if (((_a = overlayStack[index]) == null ? void 0 : _a.owner) === owner) {
        return index;
      }
    }
    return -1;
  };
  const closeOverlayEntry = (_reason, owner) => {
    const closeIndex = owner ? findOverlayEntryIndexByOwner(owner) : overlayStack.length - 1;
    const hadEntry = closeIndex >= 0;
    const [entry] = hadEntry ? overlayStack.splice(closeIndex, 1) : [null];
    suppressMapInputFor();
    if ((entry == null ? void 0 : entry.lockScroll) && !hasScrollLockingOverlay()) {
      unlockBodyScroll();
    }
    return hadEntry;
  };
  const openOverlay = (type, options = {}) => {
    openOverlayEntry(type, void 0, options);
  };
  const closeOverlay = (_reason) => {
    closeOverlayEntry();
  };
  const closeTopModalOverlay = (reason = "modal scroll lock top overlay closed") => closeOverlayEntry();
  const isOverlayOpen = () => overlayStack.length > 0;
  const getTopOverlay = () => {
    var _a;
    return ((_a = overlayStack.at(-1)) == null ? void 0 : _a.type) ?? null;
  };
  const lockModalScroll = (_owner) => {
    if (overlayStack.some((entry) => entry.owner === MODAL_SCROLL_LOCK_OWNER)) {
      return true;
    }
    openOverlayEntry("generic", MODAL_SCROLL_LOCK_OWNER);
    return true;
  };
  const unlockModalScroll = (_owner) => closeOverlayEntry("modal scroll lock released", MODAL_SCROLL_LOCK_OWNER);
  const isModalScrollLocked = (_owner) => hasScrollLockingOverlay();
  const getModalScrollLockDebugState = () => {
    const body = getBody();
    return {
      bodyLocked: (body == null ? void 0 : body.dataset[LOCKED_BODY_DATA_ATTRIBUTE]) === "true",
      bodyPosition: (body == null ? void 0 : body.style.position) || "",
      bodyTop: (body == null ? void 0 : body.style.top) || "",
      stack: overlayStack.map((entry) => ({
        type: entry.type,
        owner: entry.owner === MODAL_SCROLL_LOCK_OWNER ? "modal-scroll-lock-compat" : ""
      }))
    };
  };
  if (typeof window !== "undefined") {
    window.EmpireModalScrollLock = {
      closeTop: closeTopModalOverlay,
      debugState: getModalScrollLockDebugState,
      isLocked: isModalScrollLocked,
      lock: lockModalScroll,
      unlock: unlockModalScroll
    };
  }
  const OVERLAY_BACKDROP_ATTRIBUTE = "overlayBackdrop";
  const createOverlayBackdrop = (options = {}) => {
    const mount = options.mount ?? document.body;
    const backdrop = document.createElement("div");
    backdrop.className = "gameplay-slice-backdrop overlay-root backdrop";
    backdrop.dataset[OVERLAY_BACKDROP_ATTRIBUTE] = "true";
    const handlePointerInteraction = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const handleClick = (event) => {
      var _a;
      handlePointerInteraction(event);
      if (isOverlayOpen()) {
        const topOverlay = getTopOverlay();
        closeOverlay();
        if (topOverlay) {
          (_a = options.onCloseTopOverlay) == null ? void 0 : _a.call(options, topOverlay);
        }
        sync();
      }
    };
    backdrop.addEventListener("pointerdown", handlePointerInteraction);
    backdrop.addEventListener("pointerup", handlePointerInteraction);
    backdrop.addEventListener("click", handleClick);
    const sync = () => {
      backdrop.hidden = !isOverlayOpen();
    };
    sync();
    mount.appendChild(backdrop);
    return {
      element: backdrop,
      sync,
      destroy: () => {
        backdrop.removeEventListener("pointerdown", handlePointerInteraction);
        backdrop.removeEventListener("pointerup", handlePointerInteraction);
        backdrop.removeEventListener("click", handleClick);
        backdrop.remove();
        backdrop.hidden = true;
      }
    };
  };
  const createClientSurfaceActionRouter = (options) => ({
    handleTarget: async (target) => {
      const action = resolveClientSurfaceAction(target);
      if (!action) {
        return null;
      }
      if (action.kind === "select-district") {
        if (isOverlayOpen()) {
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
              slice,
              targetDistrictId: action.targetDistrictId,
              issuedAt
            })
          );
        case "rob":
          return options.client.dispatch(
            createRobDistrictCommand({
              commandId: options.createCommandId("command:rob"),
              slice,
              targetDistrictId: action.targetDistrictId,
              issuedAt
            })
          );
        case "heist":
          return options.client.dispatch(
            createHeistDistrictCommand({
              commandId: options.createCommandId("command:heist"),
              slice,
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
        case "occupy":
          return options.client.dispatch(
            createOccupyDistrictCommand({
              commandId: options.createCommandId("command:occupy"),
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
        case "place-defense":
          return options.client.dispatch(
            createPlaceDefenseCommand({
              commandId: options.createCommandId("command:place-defense"),
              slice,
              issuedAt
            })
          );
        case "remove-defense":
          return options.client.dispatch(
            createRemoveDefenseCommand({
              commandId: options.createCommandId("command:remove-defense"),
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
  const readStringValue = (action, key) => {
    const value = action[key];
    return typeof value === "string" && value.trim() ? value : void 0;
  };
  const readNumberValue = (action, key) => {
    const value = action[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
  };
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
  const createFetchClientTransport = (options) => {
    const fetchJson = options.fetchImpl ?? globalThis.fetch;
    const endpointBase = options.endpointBase.replace(/\/+$/u, "");
    const storage = options.storage ?? resolveBrowserStorage();
    const post = async (route, request) => {
      if (!fetchJson) {
        throw new Error("Fetch transport is unavailable in this runtime.");
      }
      const requestWithTokens = attachStoredGameplaySliceTokens(route, request, storage);
      const endpointRoute = resolveEndpointRoute(route, requestWithTokens);
      const endpoint = `${endpointBase}/${endpointRoute}`;
      const response = await fetchJson(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(requestWithTokens)
      });
      if (!response.ok) {
        throw new Error(`Gameplay slice request failed: POST ${endpoint} returned HTTP ${response.status}.`);
      }
      const payload = await response.json();
      persistGameplaySliceTokens(requestWithTokens, payload, storage);
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
  const resolveEndpointRoute = (route, request, storage) => {
    if (route !== "load") {
      return route;
    }
    const record = request;
    return String(record.joinTicket ?? "").trim() ? "join" : "load";
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
    onResponse,
    onError
  }) => {
    const safeIntervalMs = Math.max(1, Math.floor(intervalMs));
    let intervalHandle = null;
    let refreshInProgress = false;
    let pollingEnabled = enabled;
    const stop = () => {
      if (intervalHandle === null) {
        return;
      }
      timerDriver.clearInterval(intervalHandle);
      intervalHandle = null;
    };
    const refreshOnce = async () => {
      if (refreshInProgress) {
        return null;
      }
      const request = getRequest();
      if (!request) {
        return null;
      }
      refreshInProgress = true;
      try {
        const response = await load(request);
        await (onResponse == null ? void 0 : onResponse(response));
        return response;
      } catch (error) {
        onError == null ? void 0 : onError(error);
        return null;
      } finally {
        refreshInProgress = false;
      }
    };
    return {
      start: () => {
        if (!pollingEnabled || intervalHandle !== null) {
          return;
        }
        intervalHandle = timerDriver.setInterval(() => {
          void refreshOnce();
        }, safeIntervalMs);
      },
      stop,
      isRunning: () => intervalHandle !== null,
      isEnabled: () => pollingEnabled,
      setEnabled: (nextEnabled) => {
        pollingEnabled = nextEnabled;
        if (!pollingEnabled) {
          stop();
        }
      },
      refreshOnce
    };
  };
  const DAY_MAP_IMAGE_PATH = "../img/mapaden2.png";
  const renderMap = ({ districts, selectedDistrictId, phaseId }) => {
    const normalizedPhase = phaseId === "day" ? "day" : "night";
    const dayVisual = normalizedPhase === "day" ? `<span class="map-day-visual" data-map-day-image="${escapeAttribute(DAY_MAP_IMAGE_PATH)}" style="--map-day-image:url('${escapeAttribute(DAY_MAP_IMAGE_PATH)}')" aria-hidden="true"></span>` : "";
    return [
      `<section data-map-surface="district-list" data-map-phase="${escapeAttribute(normalizedPhase)}" data-selected-district-id="${escapeAttribute(selectedDistrictId ?? "")}">`,
      dayVisual,
      districts.map(
        (district) => {
          const ownerColor = toSafeCssColorValue(district.ownerColor);
          const ownerColorAttribute = ownerColor ? ` data-owner-color="${escapeAttribute(ownerColor)}" style="--map-owner-color:${escapeAttribute(ownerColor)}"` : "";
          return district.isDestroyed ? [
            `<button class="map-district map-district--destroyed" data-district-id="${escapeAttribute(district.districtId)}" data-selected="${escapeAttribute(district.isSelected)}" data-owned="${escapeAttribute(district.isOwnedByPlayer)}" data-destroyed="true" data-attack-target="${escapeAttribute(district.isAttackTarget)}" data-attack-enabled="false">`,
            `<span class="map-district__ruin-cracks" aria-hidden="true"></span>`,
            `<strong>${escapeHtml(district.label)}</strong>`,
            `<span>V piči, zničen.</span>`,
            `</button>`
          ].join("") : [
            `<button class="map-district" data-district-id="${escapeAttribute(district.districtId)}" data-selected="${escapeAttribute(district.isSelected)}" data-owned="${escapeAttribute(district.isOwnedByPlayer)}" data-destroyed="false" data-attack-target="${escapeAttribute(district.isAttackTarget)}" data-attack-enabled="${escapeAttribute(district.attackEnabled)}"${ownerColorAttribute}>`,
            `<strong>${escapeHtml(district.label)}</strong>`,
            `<span>${escapeHtml(district.ownerLabel)}</span>`,
            `<span>Zóna: ${escapeHtml(district.zoneLabel)}</span>`,
            `<span>Budovy: ${escapeHtml(district.buildingSummary)}</span>`,
            `<span>Hledanost: ${escapeHtml(district.heatLabel)} · Vliv: ${escapeHtml(district.influenceLabel)}</span>`,
            district.isAttackTarget ? `<span>${escapeHtml(district.attackEnabled ? "Attack Ready" : district.attackDisabledReason ?? "Attack unavailable")}</span>` : "",
            district.isContested ? "<span>Contested</span>" : "",
            "</button>"
          ].join("");
        }
      ).join(""),
      "</section>"
    ].join("");
  };
  const toSafeCssColorValue = (value) => {
    const normalized = String(value ?? "").trim();
    return /^[#a-zA-Z0-9(),.%\s-]+$/u.test(normalized) ? normalized : "";
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
  const createDistrictPanelViewModel = (slice, uiState, options = {}) => {
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
      selectedBuildingId,
      title: slice.district.name,
      ownershipLabel: slice.district.isOwnedByPlayer ? "Vlastní hráč" : slice.district.status === "destroyed" ? "Zničený distrikt" : slice.district.ownerPlayerId ? `Vlastní ${slice.district.ownerPlayerId}` : "Neobsazený distrikt",
      zoneLabel: toTitleCase$3(slice.district.zone),
      statusLabel: slice.district.status,
      heatLabel: formatHeatLabel$1(slice.district.heat),
      influenceLabel: String(slice.district.influence),
      buildingSummary: slice.district.status === "destroyed" ? "0 pevných budov · zničeno" : `${slice.district.buildings.length} pevných budov`,
      attackSummary: slice.district.attackTargets.length > 0 ? `${slice.district.attackTargets.filter((target) => target.enabled).length}/${slice.district.attackTargets.length} tras útoku připraveno` : "Žádné sousední trasy útoku",
      hasPendingCommand,
      trap: slice.district.trap ? {
        actionLabel: slice.district.trap.activeTrap ? "Past nastražena" : "Nastražit skrytou past",
        activeLabel: slice.district.trap.activeTrap ? `${slice.district.trap.activeTrap.label} · tick ${slice.district.trap.activeTrap.placedAtTick}` : null,
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
          const cooldown = createCooldownCountdown(action.cooldownRemainingTicks ?? 0, tickRateMs, nowMs);
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
            disabled: hasPendingCommand || !action.enabled,
            disabledReason: hasPendingCommand ? "Akce se zpracovává." : action.disabledReason,
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
          const cooldown = createCooldownCountdown(action.cooldownRemainingTicks ?? 0, tickRateMs, nowMs);
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
            inputs: action.requiresInput.map((input) => ({
              id: input.id,
              type: input.type,
              label: input.label,
              required: input.required,
              min: input.min,
              max: input.max,
              options: input.options ?? []
            })),
            cooldownLabel: cooldown.remainingMs > 0 ? `Čekání ${formatDurationMs(cooldown.remainingMs)}` : `${Math.ceil(effectiveCooldownMs / 1e3)}s čekání`,
            cooldownRemainingMs: cooldown.remainingMs,
            cooldownEndsAtMs: cooldown.endsAtMs,
            heatLabel: `+${effectiveHeatGain}`,
            influenceLabel: formatSigned$1(action.influenceChange),
            disabled: hasPendingCommand || !action.enabled,
            disabledReason: hasPendingCommand ? "Akce se zpracovává." : action.disabledReason,
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
        })
      })),
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
  const createPhaseEffectLabel = (input) => {
    if (input.phaseEffectSummary.length > 0) {
      return input.phaseEffectSummary.join(", ");
    }
    const tooltip = String(input.phaseTooltip || "").trim();
    if (tooltip) {
      return tooltip;
    }
    return null;
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
    return {
      heatLabel: String(Math.max(0, Number(police.heat || 0))),
      wantedLevelLabel: police.wantedLevelLabel || police.wantedLabel || `${police.wantedLevel} / 5`,
      pendingRaidLabel: police.pendingRaid ? `${police.pendingRaid.severity.toUpperCase()} raid` : null,
      raidConsequenceStatus: police.raidConsequenceStatus || "none",
      selectedDistrictHeatLabel: String(Math.max(0, Number(police.selectedDistrictHeat || 0))),
      protectionLabel: police.protection.sources.length > 0 ? `${police.protection.sources.join(", ")} x${police.protection.raidConsequenceMultiplier.toFixed(2)}` : "none"
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
    title: report.reportType === "spy" ? `Špehování ${report.result} v ${report.targetDistrictId}` : report.reportType === "occupy" ? `Obsazení ${report.result} v ${report.targetDistrictId}` : report.reportType === "building-action" ? `${toTitleCase(report.buildingActionId)} v ${report.districtId}` : report.districtDestroyed ? `Katastrofa v distriktu ${report.targetDistrictId}` : `Útok ${report.result} v ${report.targetDistrictId}`,
    createdAt: `${report.tick}`,
    category: report.reportType,
    summary: report.reportType === "spy" ? formatSpySummary(report) : report.reportType === "occupy" ? `Distrikt obsazen. Vliv -${report.influenceCost} · hledanost +${report.heatGained}.` : report.reportType === "building-action" ? formatBuildingActionSummary(report) : report.districtDestroyed ? "Katastrofa zničila distrikt. Kontrola, budovy, hledanost i vliv byly smazány." : report.trapTriggered ? "Během útoku se spustila past." : report.districtCaptured ? "Distrikt dobyt." : "Distrikt udržel obránce.",
    result: report.result,
    severity: report.reportType === "battle" && report.districtDestroyed ? "critical" : report.reportType === "spy" && report.result === "critical_failed" ? "critical" : "normal",
    messages: report.reportType === "building-action" ? report.messages ?? [] : report.reportType === "battle" && report.districtDestroyed ? [
      "Stav distriktu: zničený a nepoužitelný.",
      "Vlastník: nikdo.",
      "Pevné budovy: ztraceny.",
      "Všechny hlavní akce distriktu jsou vypnuté."
    ] : [],
    details: formatReportDetails(report)
  }));
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
  const renderReportLayer = (reports, options = {}) => {
    const commandStatusHtml = renderCommandReportStatus(reports, options);
    return reports.length > 0 || commandStatusHtml ? [
      `<section class="reports-panel" data-feature="reports-panel">`,
      renderCatastropheAlert(reports),
      `<div class="district-panel__section-head">`,
      `<div>`,
      `<h3 class="district-panel__section-title">Poslední reporty</h3>`,
      `<p class="district-panel__section-copy">Serverové výsledky špehování, obsazení, útoků a akcí budov pro aktuálního hráče.</p>`,
      `</div>`,
      `<span class="district-panel__section-meta">${escapeHtml(reports.length)} nových</span>`,
      `</div>`,
      commandStatusHtml,
      reports.map((report, index) => {
        var _a;
        return renderReportCard(report, {
          highlighted: Boolean(((_a = options.lastCommandStatus) == null ? void 0 : _a.accepted) && index === 0)
        });
      }).join(""),
      `</section>`
    ].join("") : "";
  };
  const renderReportCard = (report, {
    highlighted
  }) => [
    `<article class="district-panel__slot" data-report-id="${escapeAttribute(report.id)}" data-report-category="${escapeAttribute(report.category)}" data-report-type="${escapeAttribute(report.reportType)}" data-report-severity="${escapeAttribute(report.severity)}" data-report-highlight="${highlighted ? "latest-command" : "none"}">`,
    `<div class="district-panel__slot-head">`,
    `<div>`,
    `<p class="district-panel__slot-index">${escapeHtml(report.category)}</p>`,
    `<h4 class="district-panel__slot-title">${escapeHtml(report.title)}</h4>`,
    `</div>`,
    `<span class="district-panel__slot-state">${escapeHtml(report.result)}</span>`,
    `</div>`,
    `<p class="district-panel__slot-summary">${escapeHtml(report.summary)}</p>`,
    report.details.length > 0 ? `<div class="reports-panel__detail-list">${report.details.map((detail) => `<span class="reports-panel__detail">${escapeHtml(detail)}</span>`).join("")}</div>` : "",
    `<p class="district-panel__empty-copy">Tick ${escapeHtml(report.createdAt)}</p>`,
    `</article>`
  ].join("");
  const renderCommandReportStatus = (reports, options) => {
    var _a, _b;
    const status = options.lastCommandStatus;
    if (!status) {
      return "";
    }
    if (!status.accepted) {
      const message = ((_b = (_a = options.errors) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) ?? "Server akci odmítl. Zkontroluj vybraný cíl, zdroje nebo synchronizaci a zkus to znovu.";
      return [
        `<article class="district-panel__slot" data-report-command-status="rejected">`,
        `<div class="district-panel__slot-head">`,
        `<div>`,
        `<p class="district-panel__slot-index">akce</p>`,
        `<h4 class="district-panel__slot-title">Akce odmítnuta</h4>`,
        `</div>`,
        `<span class="district-panel__slot-state">odmítnuto</span>`,
        `</div>`,
        `<p class="district-panel__slot-summary">${escapeHtml(message)}</p>`,
        `</article>`
      ].join("");
    }
    if (reports.length > 0) {
      return "";
    }
    return [
      `<article class="district-panel__slot" data-report-command-status="accepted-without-report">`,
      `<div class="district-panel__slot-head">`,
      `<div>`,
      `<p class="district-panel__slot-index">akce</p>`,
      `<h4 class="district-panel__slot-title">Akce přijata</h4>`,
      `</div>`,
      `<span class="district-panel__slot-state">přijato</span>`,
      `</div>`,
      `<p class="district-panel__slot-summary">Server akci přijal, ale nevydal nový hráčský report. Výsledek ověř ve feedu a ve stavu vybraného distriktu.</p>`,
      `</article>`
    ].join("");
  };
  const renderCatastropheAlert = (reports) => {
    const catastropheReport = reports.find((report) => report.severity === "critical");
    if (!catastropheReport) {
      return "";
    }
    return [
      `<section class="reports-panel__catastrophe-window" data-catastrophe-alert="true" role="dialog" aria-label="Report katastrofy distriktu">`,
      `<div class="district-panel__section-head">`,
      `<div>`,
      `<h3 class="district-panel__section-title">${escapeHtml(catastropheReport.title)}</h3>`,
      `<p class="district-panel__section-copy">${escapeHtml(catastropheReport.summary)}</p>`,
      `</div>`,
      `<span class="district-panel__section-meta">${escapeHtml(catastropheReport.result)}</span>`,
      `</div>`,
      `<div class="district-panel__slot-list">`,
      catastropheReport.messages.map((message) => `<p class="district-panel__action-reason">${escapeHtml(message)}</p>`).join(""),
      `</div>`,
      `</section>`
    ].join("");
  };
  const renderSidePanelShell = ({ activePanel, contentHtml }) => activePanel ? `<aside class="side-panel-shell mobile-sheet" data-panel="${escapeAttribute(activePanel)}"><div class="mobile-sheet__body">${contentHtml}</div></aside>` : '<aside class="side-panel-shell" data-panel="none"></aside>';
  const renderTopBarShell = ({ player }) => {
    var _a;
    return player ? `<header data-mode="${escapeAttribute(player.modeLabel)}" data-city-phase="${escapeAttribute(((_a = player.dayNight) == null ? void 0 : _a.uiThemeHint) ?? "day")}">Mode: ${escapeHtml(player.modeLabel)} · Player: ${escapeHtml(player.playerId)}${renderHomeDistrict(player)} · Resources: ${escapeHtml(player.resourceSummary)} · Alerts: ${escapeHtml(player.notificationCount)}${renderPoliceBadge(player)}${renderDayNightBadge(player)}</header>` : "";
  };
  const renderHomeDistrict = (player) => player.homeDistrictId ? ` · Server assigned home: ${escapeHtml(player.homeDistrictId)}` : "";
  const renderPoliceBadge = (player) => {
    const police = player.police;
    if (!police) return "";
    const pending = police.pendingRaidLabel ? ` · Pending: ${escapeHtml(police.pendingRaidLabel)}` : "";
    return ` · <span class="police-badge" data-raid-status="${escapeAttribute(police.raidConsequenceStatus)}" title="${escapeAttribute(`Hledanost distriktu ${police.selectedDistrictHeatLabel} · Ochrana ${police.protectionLabel}`)}">Hledanost ${escapeHtml(police.heatLabel)} · Wanted ${escapeHtml(police.wantedLevelLabel)}${pending}</span>`;
  };
  const renderDayNightBadge = (player) => {
    const dayNight = player.dayNight;
    if (!dayNight) return "";
    const summary = dayNight.effectSummary.slice(0, 2).join(", ");
    const recommendations = (dayNight.recommendations ?? []).slice(0, 4).join(" · ");
    const nextPhaseLabel = dayNight.phaseId === "night" ? "dne" : "noci";
    const clockLabel = dayNight.gameClockLabel ?? "--:--";
    const remainingLabel = formatDayNightRemaining(dayNight);
    const title = [
      summary,
      recommendations ? `Teď se vyplatí: ${recommendations}` : ""
    ].filter(Boolean).join(" | ");
    return ` · <span class="day-night-badge" data-city-phase="${escapeAttribute(dayNight.uiThemeHint)}" title="${escapeAttribute(title)}">${escapeHtml(dayNight.label)} · ${escapeHtml(clockLabel)} · do ${escapeHtml(nextPhaseLabel)} ${escapeHtml(remainingLabel)}</span>`;
  };
  const formatDayNightRemaining = (dayNight) => {
    const phaseTicks = Math.max(1, Math.floor(Number(dayNight.endsAtTick - dayNight.startedAtTick) || 1));
    const realPhaseDurationMs = Math.max(0, Number(dayNight.realPhaseDurationMs ?? 0));
    const remainingMs = realPhaseDurationMs > 0 ? Math.round(Math.max(0, Number(dayNight.remainingTicks || 0)) / phaseTicks * realPhaseDurationMs) : 0;
    const totalMinutes = Math.max(0, Math.ceil(remainingMs / 6e4));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };
  const renderClientShell = (store) => {
    var _a, _b, _c, _d, _e, _f, _g;
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
    const sidePanelContent = [
      renderSpawnSelectionPanel(readModel.gameplaySlice),
      districtPanel ? renderDistrictPanel(districtPanel) : "",
      renderReportLayer(reports, {
        errors: readModel.lastErrors,
        lastCommandStatus: uiState.lastCommandStatus
      })
    ].join("");
    return {
      topBarHtml: renderTopBarShell({
        player
      }),
      mapHtml: renderMap({
        districts: mapDistricts,
        selectedDistrictId: uiState.selectedDistrictId,
        phaseId: ((_f = player == null ? void 0 : player.dayNight) == null ? void 0 : _f.phaseId) ?? ((_g = player == null ? void 0 : player.dayNight) == null ? void 0 : _g.uiThemeHint) ?? null
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
      connection: readModel.connection,
      lastCommandStatus: uiState.lastCommandStatus
    };
  };
  const renderSpawnSelectionPanel = (slice) => {
    if (!(slice == null ? void 0 : slice.spawnSelection) || slice.spawnSelection.status !== "awaiting_spawn_selection") {
      return "";
    }
    return [
      `<section class="spawn-selection-panel" data-feature="spawn-selection">`,
      `<header><p>Lobby</p><h2>Vyber startovní district</h2></header>`,
      `<p>Každý hráč začíná s jedním districtem. Výběr je po potvrzení závazný.</p>`,
      `<div class="spawn-selection-panel__list">`,
      ...slice.spawnSelection.districts.map((district) => [
        `<article class="spawn-selection-panel__item" data-spawn-status="${escapeAttribute(district.status)}">`,
        `<h3>${escapeHtml(district.districtName)}</h3>`,
        `<p>Typ: ${escapeHtml(district.districtType)} · Budova: ${escapeHtml(district.buildingType ?? "Neznámá")} · Sousedé: ${district.neighborCount}</p>`,
        `<p>Spawn zóna: ${escapeHtml((district.spawnZones ?? []).join(", ") || "-")}</p>`,
        district.ownerPublicName ? `<p>Obsazeno: ${escapeHtml(district.ownerPublicName)}</p>` : "",
        district.status === "available" ? `<button type="button" data-select-spawn-district-id="${escapeAttribute(district.districtId)}">POTVRDIT A ZABRAT</button>` : `<button type="button" disabled>${escapeHtml(formatSpawnStatus(district.status))}</button>`,
        `</article>`
      ].join("")),
      `</div>`,
      `</section>`
    ].join("");
  };
  const formatSpawnStatus = (status) => {
    switch (status) {
      case "occupied":
        return "Obsazeno";
      case "locked":
        return "Zamčeno";
      case "disabled":
        return "Nedostupné";
      case "selected_by_me":
        return "Vybráno";
      case "reserved_by_other":
        return "Právě vybírá jiný hráč";
      default:
        return "Nedostupné";
    }
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
  const spawnSelectionFeature = "spawn-selection";
  const createClientApp = ({ transport }) => {
    const store = createClientStore(createInitialClientUiState());
    const dispatcher = createCommandDispatcher(transport);
    let renderState = createInitialClientRenderState();
    const commitResponse = (response, selectedDistrictId, commandId) => {
      var _a, _b, _c;
      const hasAuthoritativeReadModel = Boolean(response.readModel);
      const missingReadModelMessage = "Gameplay slice response did not include an authoritative read model.";
      const mapManifestMismatch = getMapManifestMismatch(response);
      const responseErrors = mapManifestMismatch ? [...response.errors, mapManifestMismatch] : response.errors;
      const firstErrorMessage = ((_a = responseErrors[0]) == null ? void 0 : _a.message) ?? null;
      if (response.readModel) {
        const serverSelectedDistrictId = ((_b = response.readModel.district) == null ? void 0 : _b.districtId) ?? response.readModel.player.homeDistrictId ?? selectedDistrictId ?? null;
        const activeSidePanel = ((_c = response.readModel.spawnSelection) == null ? void 0 : _c.status) === "awaiting_spawn_selection" ? spawnSelectionFeature : districtPanelFeature;
        store.setGameplaySlice(response.readModel);
        store.patchUiState({
          selectedDistrictId: serverSelectedDistrictId,
          activeSidePanel
        });
      }
      if (commandId) {
        store.patchUiState({
          lastCommandStatus: {
            commandId,
            accepted: response.accepted
          }
        });
      }
      store.setGameplaySliceMetadata(response.metadata ?? (response.readModel ? {
        serverTick: response.readModel.server.currentTick,
        stateVersion: response.readModel.server.stateVersion
      } : null));
      store.setErrors(responseErrors);
      store.setConnectionState({
        status: hasAuthoritativeReadModel && !mapManifestMismatch ? "ready" : "error",
        lastErrorMessage: firstErrorMessage ?? (hasAuthoritativeReadModel ? null : missingReadModelMessage),
        staleData: responseErrors.length > 0 || !hasAuthoritativeReadModel
      });
      renderState = renderClientShell(store);
      return renderState;
    };
    const commitTransportFailure = (message, commandId) => {
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
      if (commandId) {
        store.patchUiState({
          lastCommandStatus: {
            commandId,
            accepted: false
          }
        });
      }
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
        districtId,
        factionId: playerView.factionId
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
        } catch (error) {
          return commitTransportFailure(
            createTransportFailureMessage("Unable to load gameplay slice from server.", error)
          );
        }
      },
      clearDistrictSelection: () => {
        store.patchUiState({
          activeSidePanel: null,
          selectedBuildingId: null,
          selectedDistrictId: null
        });
        renderState = renderClientShell(store);
        return renderState;
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
        } catch (error) {
          return commitTransportFailure(
            createTransportFailureMessage("Unable to load selected district from server.", error)
          );
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
        var _a;
        const uiState = store.getUiState();
        const currentSlice = store.getReadModel().gameplaySlice;
        if (hasCurrentMapManifestMismatch(currentSlice)) {
          return commitTransportFailure("Client map manifest does not match the server map manifest. Map actions are disabled.", command.id);
        }
        if (!uiState.selectedDistrictId && command.type !== "select-spawn-district") {
          return commitTransportFailure("No district is selected for the district panel slice.", command.id);
        }
        store.patchUiState({
          pendingCommandIds: [...uiState.pendingCommandIds, command.id]
        });
        renderState = renderClientShell(store);
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
          return commitResponse(response, uiState.selectedDistrictId, command.id);
        } catch (_error) {
          store.patchUiState({
            pendingCommandIds: store.getUiState().pendingCommandIds.filter((pendingCommandId) => pendingCommandId !== command.id)
          });
          return commitTransportFailure(
            createTransportFailureMessage("Unable to submit gameplay command to server.", _error),
            command.id
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
  const DEFAULT_SESSION_STORAGE_KEY = "empireStreets.session.v1";
  const LEGACY_PUBLIC_SERVER_ID_MIGRATIONS = {
    "war-eu-01": "instance:war:eu-central:public-1",
    "war-eu-02": "instance:war:eu-central:public-1",
    "war-eu-03": "instance:war:eu-central:public-1",
    "war-eu-04": "instance:war:eu-central:public-1",
    "war-eu-05": "instance:war:eu-central:public-1",
    "free-eu-01": "instance:free:eu-central:public-1",
    "free-eu-02": "instance:free:eu-central:public-2",
    "free-eu-03": "instance:free:eu-central:public-2"
  };
  const resolveGameplaySliceBootstrapRequest = (dataset, storage) => {
    const explicit = createExplicitRequest(dataset);
    if (explicit) {
      return explicit;
    }
    const session = readLegacySession(storage, dataset.sessionStorageKey);
    const registration = session == null ? void 0 : session.registration;
    const serverInstanceId = normalizeServerInstanceId(
      (registration == null ? void 0 : registration.activeServerInstanceId) || (registration == null ? void 0 : registration.serverInstanceId) || (registration == null ? void 0 : registration.activeServerId) || (registration == null ? void 0 : registration.serverId)
    );
    const preferredStartDistrictId = normalizeDistrictId(
      (registration == null ? void 0 : registration.preferredStartDistrictId) || (registration == null ? void 0 : registration.startDistrictId)
    );
    const districtId = normalizeDistrictId(
      (registration == null ? void 0 : registration.lastServerConfirmedDistrictId) || (registration == null ? void 0 : registration.assignedHomeDistrictId)
    );
    const playerId = normalizePlayerId((registration == null ? void 0 : registration.identity) || (registration == null ? void 0 : registration.gangName));
    const accountId = normalizeToken((registration == null ? void 0 : registration.accountId) || (registration == null ? void 0 : registration.identity) || (registration == null ? void 0 : registration.gangName));
    const factionId = normalizeFactionId((registration == null ? void 0 : registration.factionId) || (registration == null ? void 0 : registration.selectedFaction));
    const joinTicket = normalizeToken(registration == null ? void 0 : registration.joinTicket);
    if (!serverInstanceId || !playerId) {
      return null;
    }
    return {
      serverInstanceId,
      playerId,
      ...accountId ? { accountId } : {},
      ...districtId ? { districtId } : {},
      ...preferredStartDistrictId ? { preferredStartDistrictId } : {},
      factionId,
      ...joinTicket ? { joinTicket } : {}
    };
  };
  const createExplicitRequest = (dataset) => {
    const serverInstanceId = normalizeToken(dataset.serverInstanceId);
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
  const normalizeServerInstanceId = (value) => {
    const normalized = normalizeToken(value);
    if (!normalized) {
      return null;
    }
    const migrated = LEGACY_PUBLIC_SERVER_ID_MIGRATIONS[normalized] ?? normalized;
    return migrated.startsWith("instance:") ? migrated : `instance:${migrated}`;
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
  const normalizeFactionId = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  };
  const persistServerConfirmedGameplaySliceFocus = (storage, storageKey, gameplaySlice) => {
    var _a;
    const assignedHomeDistrictId = normalizeStorageToken(gameplaySlice == null ? void 0 : gameplaySlice.player.homeDistrictId);
    const lastServerConfirmedDistrictId = normalizeStorageToken(
      ((_a = gameplaySlice == null ? void 0 : gameplaySlice.district) == null ? void 0 : _a.districtId) || assignedHomeDistrictId
    );
    const serverConfirmedFactionId = normalizeStorageToken(gameplaySlice == null ? void 0 : gameplaySlice.player.factionId);
    if (!storage || !lastServerConfirmedDistrictId) {
      return;
    }
    try {
      const key = storageKey || DEFAULT_SESSION_STORAGE_KEY;
      const parsed = JSON.parse(storage.getItem(key) || "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return;
      }
      const registration = parsed.registration && typeof parsed.registration === "object" && !Array.isArray(parsed.registration) ? parsed.registration : {};
      storage.setItem(key, JSON.stringify({
        ...parsed,
        registration: {
          ...registration,
          ...assignedHomeDistrictId ? { assignedHomeDistrictId } : {},
          ...serverConfirmedFactionId ? {
            factionId: serverConfirmedFactionId,
            selectedFaction: serverConfirmedFactionId,
            serverConfirmedFactionId
          } : {},
          lastServerConfirmedDistrictId
        }
      }));
    } catch (_error) {
    }
  };
  const normalizeStorageToken = (value) => {
    const normalized = String(value ?? "").trim();
    return normalized.length > 0 ? normalized : null;
  };
  const MOBILE_DISTRICT_SHEET_SCROLL_MEDIA = "(max-width: 720px), (hover: none) and (pointer: coarse), (any-hover: none), (any-pointer: coarse)";
  const shouldLockDistrictSheetScroll = () => {
    var _a;
    return !(typeof window !== "undefined" && ((_a = window.matchMedia) == null ? void 0 : _a.call(window, MOBILE_DISTRICT_SHEET_SCROLL_MEDIA).matches));
  };
  const createDistrictSheetOverlayController = () => {
    let isDistrictSheetOpen = false;
    const syncFromState = (state) => {
      var _a;
      const shouldShowDistrictSheet = Boolean((_a = state.districtPanel) == null ? void 0 : _a.districtId);
      if (shouldShowDistrictSheet && !isDistrictSheetOpen) {
        openOverlay("district_sheet", { lockScroll: shouldLockDistrictSheetScroll() });
        isDistrictSheetOpen = true;
        return;
      }
      if (!shouldShowDistrictSheet && isDistrictSheetOpen && getTopOverlay() === "district_sheet") {
        closeOverlay();
        isDistrictSheetOpen = false;
      }
    };
    const closeOnDestroy = () => {
      if (isDistrictSheetOpen && getTopOverlay() === "district_sheet") {
        closeOverlay();
      }
      isDistrictSheetOpen = false;
    };
    const closeFromExternal = (reason) => {
      if (getTopOverlay() === "district_sheet") {
        closeOverlay();
      }
      isDistrictSheetOpen = false;
    };
    return {
      syncFromState,
      closeFromExternal,
      closeOnDestroy,
      isOpen: () => isDistrictSheetOpen,
      markClosedByBackdrop: () => {
        isDistrictSheetOpen = false;
      }
    };
  };
  const setGameplayRuntimeMarker = (root, marker, details = {}) => {
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
  };
  const isGameplayDiagnosticsEnabled = () => {
    if (typeof window === "undefined") {
      return false;
    }
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || window.location.search.includes("gameplayDiagnostics=1");
  };
  const writeGameplaySliceDiagnostic = (endpoint, message) => {
    if (!isGameplayDiagnosticsEnabled()) {
      return;
    }
    console.warn("[gameplay-slice] Server-authoritative runtime failed; legacy fallback remains active.", {
      endpoint,
      error: sanitizeDiagnosticText(message, 240)
    });
  };
  const renderGameplaySliceDiagnostic = (endpoint, message) => [
    `<strong>Server-authoritative gameplay slice unavailable</strong>`,
    `<span>Legacy fallback is active for this local session.</span>`,
    `<span data-gameplay-slice-diagnostic-endpoint>${escapeHtml(endpoint)}</span>`,
    `<span data-gameplay-slice-diagnostic-error>${escapeHtml(sanitizeDiagnosticText(message, 240))}</span>`
  ].join("");
  const createSafeErrorMessage = (error) => error instanceof Error && error.message.trim() ? error.message.trim() : "Unknown gameplay slice error.";
  const sanitizeDiagnosticText = (value, maxLength) => String(value || "").replace(/(snapshotToken|sessionToken|token)["':=\s]+[^,}\s]+/giu, "$1=<redacted>").replace(/[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/gu, "<redacted-token>").slice(0, maxLength);
  const DEFAULT_ENDPOINT_BASE = "/api/gameplay-slice";
  const LEGACY_DISTRICT_POPUP_SELECTOR = "[data-testid='district-popup']";
  const MOBILE_SHEET_SELECTOR = ".mobile-sheet";
  const MAP_TAP_PIXEL_THRESHOLD = 10;
  const DISTRICT_TAP_DEBOUNCE_MS = 350;
  const activeGameplaySlicePages = /* @__PURE__ */ new Set();
  const mountGameplaySlicePage = (options) => {
    const request = resolveGameplaySliceBootstrapRequest(options.root.dataset, getBrowserStorage());
    if (!request) {
      setGameplayRuntimeMarker(options.root, "demo-ready", {
        fallback: "legacy",
        serverRuntime: "not-requested"
      });
      options.root.hidden = true;
      return null;
    }
    const endpointBase = options.root.dataset.gameplaySliceEndpointBase || DEFAULT_ENDPOINT_BASE;
    setGameplayRuntimeMarker(options.root, "initializing", { endpoint: `${endpointBase}/load` });
    const client = createClientApp({
      transport: options.transport ?? createFetchClientTransport({ endpointBase })
    });
    const router = createClientSurfaceActionRouter({
      client,
      createCommandId: createBrowserCommandId
    });
    const mounts = resolveMounts(options.root);
    let currentLoadRequest = request;
    const districtSheetOverlay = createDistrictSheetOverlayController();
    let pointerOrigin = null;
    let lastPointerTapIsValid = true;
    let lastDistrictTap = { districtId: null, atMs: 0 };
    let pendingDistrictSelection = { districtId: null };
    let activeDistrictSheetId = null;
    const clearDistrictSheetFocus = () => {
      activeDistrictSheetId = null;
      currentLoadRequest = {
        ...currentLoadRequest,
        districtId: void 0
      };
    };
    const overlayBackdrop = createOverlayBackdrop({
      mount: options.root,
      onCloseTopOverlay: (type) => {
        var _a;
        if (type !== "district_sheet") {
          return;
        }
        clearDistrictSheetFocus();
        districtSheetOverlay.markClosedByBackdrop();
        render(((_a = client.clearDistrictSelection) == null ? void 0 : _a.call(client)) ?? client.getRenderState());
      }
    });
    const closeDistrictSheetAfterLegacyClose = (reason) => {
      var _a;
      if (!districtSheetOverlay.isOpen() && getTopOverlay() !== "district_sheet") {
        return false;
      }
      clearDistrictSheetFocus();
      districtSheetOverlay.closeFromExternal(reason);
      overlayBackdrop.sync();
      render(((_a = client.clearDistrictSelection) == null ? void 0 : _a.call(client)) ?? client.getRenderState());
      return true;
    };
    const handleLegacyDistrictClosed = () => {
      closeDistrictSheetAfterLegacyClose("legacy district popup closed");
    };
    const legacyDistrictPopup = document.querySelector(LEGACY_DISTRICT_POPUP_SELECTOR);
    const legacyDistrictPopupObserver = typeof MutationObserver !== "undefined" && legacyDistrictPopup ? new MutationObserver(() => {
      const isHidden = legacyDistrictPopup.hidden || legacyDistrictPopup.getAttribute("aria-hidden") === "true" || legacyDistrictPopup.classList.contains("hidden");
      if (isHidden) {
        closeDistrictSheetAfterLegacyClose("legacy district popup hidden");
      }
    }) : null;
    const hideUnavailableGameplaySlice = (state = null) => {
      const message = (state == null ? void 0 : state.connection.lastErrorMessage) || "Gameplay slice did not return an authoritative read model.";
      const endpoint = `${endpointBase}/load`;
      setGameplayRuntimeMarker(options.root, "demo-ready", {
        endpoint,
        error: message,
        fallback: "legacy",
        serverRuntime: "server-authoritative-error"
      });
      writeGameplaySliceDiagnostic(endpoint, message);
      options.root.dataset.gameplaySliceUnavailable = "true";
      if (isGameplayDiagnosticsEnabled()) {
        options.root.hidden = false;
        mounts.status.innerHTML = renderGameplaySliceDiagnostic(endpoint, message);
        mounts.topBar.innerHTML = "";
        mounts.map.innerHTML = "";
        mounts.panel.innerHTML = "";
      } else {
        options.root.hidden = true;
        Object.values(mounts).forEach((mount) => {
          mount.innerHTML = "";
        });
      }
    };
    function render(state) {
      var _a, _b, _c, _d;
      const gameplaySlice = client.getGameplaySlice();
      if (!gameplaySlice && state.connection.status === "error") {
        hideUnavailableGameplaySlice(state);
        return;
      }
      delete options.root.dataset.gameplaySliceUnavailable;
      setGameplayRuntimeMarker(options.root, "server-authoritative-ready");
      options.root.hidden = false;
      if (((_a = gameplaySlice == null ? void 0 : gameplaySlice.spawnSelection) == null ? void 0 : _a.status) === "awaiting_spawn_selection" && !gameplaySlice.player.homeDistrictId) {
        options.root.dataset.spawnSelectionVisible = "true";
      } else {
        delete options.root.dataset.spawnSelectionVisible;
      }
      if ((_b = state.districtPanel) == null ? void 0 : _b.districtId) {
        activeDistrictSheetId = state.districtPanel.districtId;
        currentLoadRequest = {
          ...currentLoadRequest,
          districtId: state.districtPanel.districtId
        };
      } else {
        activeDistrictSheetId = null;
      }
      persistServerConfirmedGameplaySliceFocus(
        getBrowserStorage(),
        options.root.dataset.sessionStorageKey,
        client.getGameplaySlice()
      );
      const phase = (_d = (_c = state.player) == null ? void 0 : _c.dayNight) == null ? void 0 : _d.uiThemeHint;
      if (phase) {
        document.body.dataset.cityPhase = phase;
      }
      document.dispatchEvent(new CustomEvent("empire:gameplay-slice-rendered", { detail: { gameplaySlice, playerView: (gameplaySlice == null ? void 0 : gameplaySlice.player) ?? null } }));
      mounts.status.innerHTML = renderGameplaySliceStatus(state);
      mounts.topBar.innerHTML = state.topBarHtml;
      mounts.map.innerHTML = state.mapHtml;
      mounts.panel.innerHTML = state.sidePanelHtml;
      refreshLiveCooldownLabels(options.root);
      districtSheetOverlay.syncFromState(state);
      overlayBackdrop.sync();
    }
    const isInsideMobileSheet = (target) => target instanceof HTMLElement && Boolean(target.closest(MOBILE_SHEET_SELECTOR));
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(event instanceof PointerEvent) || !(target instanceof HTMLElement)) {
        return;
      }
      if (isInsideMobileSheet(target)) {
        event.stopPropagation();
      } else if (shouldSuppressMapInput(event)) {
        return;
      }
      pointerOrigin = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        atMs: Date.now()
      };
      lastPointerTapIsValid = true;
    };
    const handlePointerUp = (event) => {
      if (!(event instanceof PointerEvent) || !pointerOrigin || event.pointerId !== pointerOrigin.pointerId) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && !isInsideMobileSheet(target) && shouldSuppressMapInput(event)) {
        pointerOrigin = null;
        lastPointerTapIsValid = false;
        return;
      }
      const dx = event.clientX - pointerOrigin.x;
      const dy = event.clientY - pointerOrigin.y;
      lastPointerTapIsValid = Math.hypot(dx, dy) <= MAP_TAP_PIXEL_THRESHOLD;
      pointerOrigin = null;
    };
    const handlePointerCancel = (event) => {
      if (!(event instanceof PointerEvent) || !pointerOrigin || event.pointerId !== pointerOrigin.pointerId) {
        return;
      }
      lastPointerTapIsValid = false;
      pointerOrigin = null;
    };
    const handleClick = async (event) => {
      const target = event.target;
      const canUsePointerTapForDistrictSelection = lastPointerTapIsValid;
      lastPointerTapIsValid = true;
      const insideSheet = isInsideMobileSheet(target);
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (insideSheet) {
        event.stopPropagation();
      }
      const action = resolveClientSurfaceAction(target);
      if ((action == null ? void 0 : action.kind) === "select-district") {
        if (!insideSheet && shouldSuppressMapInput(event)) {
          return;
        }
        if (!canUsePointerTapForDistrictSelection) {
          return;
        }
        const topOverlay = getTopOverlay();
        if (isOverlayOpen() && topOverlay !== "district_sheet") {
          return;
        }
        const selectedAtMs = Date.now();
        const isRapidRepeat = action.districtId === lastDistrictTap.districtId && selectedAtMs - lastDistrictTap.atMs < DISTRICT_TAP_DEBOUNCE_MS;
        const isSameDistrictAsOpen = action.districtId === activeDistrictSheetId;
        const isDistrictOpen = districtSheetOverlay.isOpen();
        if (isDistrictOpen && isSameDistrictAsOpen) {
          return;
        }
        if (!isDistrictOpen && (isRapidRepeat || pendingDistrictSelection.districtId !== null)) {
          return;
        }
        lastDistrictTap = { districtId: action.districtId, atMs: selectedAtMs };
        pendingDistrictSelection = { districtId: action.districtId };
        if (isDistrictOpen) {
          try {
            const nextState2 = await client.selectDistrict(action.districtId);
            if (nextState2) {
              event.preventDefault();
              event.stopPropagation();
              render(nextState2);
            }
          } finally {
            pendingDistrictSelection = { districtId: null };
          }
          return;
        }
      }
      if ((action == null ? void 0 : action.kind) === "select-district" && isOverlayOpen()) {
        return;
      }
      let nextState = null;
      try {
        nextState = await router.handleTarget(target);
      } finally {
        if ((action == null ? void 0 : action.kind) === "select-district") {
          pendingDistrictSelection = { districtId: null };
        }
      }
      if (nextState) {
        event.preventDefault();
        event.stopPropagation();
        render(nextState);
      }
    };
    const poller = createGameplaySlicePoller({
      load: (nextRequest) => client.load(nextRequest),
      getRequest: () => currentLoadRequest,
      intervalMs: parsePollingIntervalMs(options.root.dataset.gameplaySlicePollingIntervalMs),
      enabled: options.root.dataset.gameplaySlicePolling === "true",
      onResponse: render,
      onError: () => {
        mounts.status.innerHTML = [
          "<strong>Synchronizace se serverem zastarala</strong>",
          "<span>Obnova ze serveru selhala. Zůstává poslední známý stav.</span>"
        ].join("");
      }
    });
    const cooldownTimerId = window.setInterval(() => refreshLiveCooldownLabels(options.root), 1e3);
    legacyDistrictPopupObserver == null ? void 0 : legacyDistrictPopupObserver.observe(legacyDistrictPopup, {
      attributeFilter: ["aria-hidden", "class", "hidden"],
      attributes: true
    });
    document.addEventListener("empire:district-closed", handleLegacyDistrictClosed);
    options.root.addEventListener("click", handleClick);
    options.root.addEventListener("pointerdown", handlePointerDown);
    options.root.addEventListener("pointerup", handlePointerUp);
    options.root.addEventListener("pointercancel", handlePointerCancel);
    void client.load(request).then((state) => {
      render(state);
      poller.start();
    }).catch((error) => {
      hideUnavailableGameplaySlice({
        ...client.getRenderState(),
        connection: {
          status: "error",
          lastErrorMessage: createSafeErrorMessage(error),
          staleData: true
        }
      });
    });
    const mountedPage = {
      closeDistrictSheetFromExternal: (reason = "external district popup close") => closeDistrictSheetAfterLegacyClose(reason),
      destroy: () => {
        poller.stop();
        window.clearInterval(cooldownTimerId);
        legacyDistrictPopupObserver == null ? void 0 : legacyDistrictPopupObserver.disconnect();
        document.removeEventListener("empire:district-closed", handleLegacyDistrictClosed);
        options.root.removeEventListener("click", handleClick);
        options.root.removeEventListener("pointerdown", handlePointerDown);
        options.root.removeEventListener("pointerup", handlePointerUp);
        options.root.removeEventListener("pointercancel", handlePointerCancel);
        districtSheetOverlay.closeOnDestroy();
        overlayBackdrop.sync();
        overlayBackdrop.destroy();
        activeGameplaySlicePages.delete(mountedPage);
      }
    };
    activeGameplaySlicePages.add(mountedPage);
    return mountedPage;
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
  const renderGameplaySliceStatus = (state) => {
    var _a;
    return [
      state.connection.status === "error" ? "" : `<strong>${escapeHtml(state.connection.status === "ready" ? "Server synchronizován" : state.connection.status)}</strong>`,
      state.lastCommandStatus ? `<span class="gameplay-slice-client__command-status">${state.lastCommandStatus.accepted ? "Akce přijata" : "Akce odmítnuta"}</span>` : "",
      state.connection.status !== "error" && ((_a = state.lastCommandStatus) == null ? void 0 : _a.accepted) === false && state.connection.lastErrorMessage ? `<span class="gameplay-slice-client__error">${escapeHtml(state.connection.lastErrorMessage)}</span>` : "",
      state.districtPanel ? `<span>${escapeHtml(state.districtPanel.title)}</span>` : ""
    ].join("");
  };
  const createBrowserCommandId = (prefix) => `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  const parsePollingIntervalMs = (value) => {
    const intervalMs = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 5e3;
  };
  const closeDistrictSheet = (reason = "external district popup close") => {
    let closed = false;
    for (const mountedPage of activeGameplaySlicePages) {
      closed = mountedPage.closeDistrictSheetFromExternal(reason) || closed;
    }
    return closed;
  };
  const createPageApi = () => ({
    closeDistrictSheet,
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
  exports.closeDistrictSheet = closeDistrictSheet;
  exports.mountGameplaySlicePage = mountGameplaySlicePage;
  exports.persistServerConfirmedGameplaySliceFocus = persistServerConfirmedGameplaySliceFocus;
  exports.renderGameplaySliceStatus = renderGameplaySliceStatus;
  exports.setGameplayRuntimeMarker = setGameplayRuntimeMarker;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
