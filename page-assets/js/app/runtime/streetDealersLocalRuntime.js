const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function resolveLocalStreetDealerSlotCount(ownedCount, config) {
  void ownedCount;
  return Array.isArray(config?.dealerSlots) ? config.dealerSlots.length : 0;
}

export function normalizeLocalStreetDealerSales(value) {
  const slots = Array.isArray(value?.slots) ? value.slots : [];
  return {
    slots: slots
      .filter((slot) => slot && typeof slot === "object" && String(slot.slotId || ""))
      .map((slot) => ({
        ...slot,
        slotId: String(slot.slotId),
        itemId: String(slot.itemId || ""),
        itemLabel: String(slot.itemLabel || slot.itemId || ""),
        amount: Math.max(0, Math.floor(Number(slot.amount || 0))),
        startedAt: Math.max(0, Number(slot.startedAt || 0)),
        completesAt: Math.max(0, Number(slot.completesAt || 0)),
        rewardDirtyCash: Math.max(0, Math.floor(Number(slot.rewardDirtyCash || 0))),
        heatGain: Math.max(0, Math.ceil(Number(slot.heatGain || 0))),
        streetRiskPct: clamp(Number(slot.streetRiskPct || 0), 0, 100)
      }))
      .filter((slot) => slot.itemId && slot.amount > 0 && slot.completesAt > 0)
  };
}

export function createLocalStreetDealerSaleView({
  config,
  ownedCount,
  inventory = {},
  saleState = {},
  phase = "night",
  dayNightRule = {},
  now = Date.now()
}) {
  const slotCount = resolveLocalStreetDealerSlotCount(ownedCount, config);
  const normalized = normalizeLocalStreetDealerSales(saleState);
  const slotsById = new Map(normalized.slots.map((slot) => [slot.slotId, slot]));
  const phaseModifiers = resolveDayNightModifiers(phase, dayNightRule);
  return {
    phase: phase === "day" ? "day" : "night",
    phaseStatusLabel: formatPhaseStatus(phaseModifiers),
    slotCount,
    slots: config.dealerSlots.map((slotConfig, index) => {
      const slotId = slotConfig.slotId;
      const activeSale = slotsById.get(slotId) ?? null;
      const drug = config.sellableDrugs.find((candidate) => candidate.itemId === slotConfig.itemId) ?? null;
      const ownedAmount = Math.max(0, Math.floor(Number(inventory[drug?.itemId] || 0)));
      return {
        slotId,
        label: drug?.label || slotConfig.itemId,
        itemId: drug?.itemId || slotConfig.itemId,
        itemLabel: drug?.label || slotConfig.itemId,
        ownedAmount,
        unitSalePriceDirtyCash: Number(drug?.unitSalePriceDirtyCash || 0),
        minimumAmountPerSale: Math.max(1, Number(drug?.minimumAmountPerSale || 1)),
        activeSale,
        locked: normalized.slots.some((candidate) => candidate.completesAt > now),
        statusLabel: activeSale && activeSale.completesAt > now
          ? `Prodej běží · ${formatRemaining(activeSale.completesAt - now)}`
          : ""
      };
    }),
    items: config.sellableDrugs.map((drug) => ({
      itemId: drug.itemId,
      label: drug.label,
      ownedAmount: Math.max(0, Math.floor(Number(inventory[drug.itemId] || 0))),
      minimumAmountPerSale: Math.max(1, Number(drug.minimumAmountPerSale || 1)),
      unitSalePriceDirtyCash: Number(drug.unitSalePriceDirtyCash || 0)
    }))
  };
}

export function startLocalStreetDealerSale({
  config,
  ownedCount,
  inventory = {},
  saleState = {},
  slotId,
  itemId,
  amount,
  phase = "night",
  dayNightRule = {},
  tunnelSupport = {},
  openChannel = {},
  now = Date.now()
}) {
  const requestedAmount = Number(amount);
  if (!Number.isInteger(requestedAmount) || requestedAmount <= 0) {
    return failure("street_dealers_invalid_amount", "Zadej kladné celé množství.");
  }
  const slotCount = resolveLocalStreetDealerSlotCount(ownedCount, config);
  const slotIndex = Number(String(slotId || "").replace(/^slot-/u, ""));
  if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > slotCount) {
    return failure("street_dealers_invalid_slot", "Vybraná prodejná látka není dostupná.");
  }
  const slotConfig = config.dealerSlots.find((candidate) => candidate.slotId === slotId);
  const drug = slotConfig
    ? config.sellableDrugs.find((candidate) => candidate.itemId === slotConfig.itemId)
    : null;
  if (!drug) {
    return failure("street_dealers_invalid_drug_item", "Tuto položku Pouliční dealeři neprodávají.");
  }
  if (itemId !== undefined && String(itemId) !== drug.itemId && !(drug.aliases || []).includes(String(itemId))) {
    return failure("street_dealers_slot_product_mismatch", "Vybraná látka neodpovídá této prodejní nabídce.");
  }
  if (requestedAmount < drug.minimumAmountPerSale) {
    return failure("street_dealers_minimum_amount", `Do prodeje nastav alespoň ${drug.minimumAmountPerSale} ks.`);
  }
  const stock = Math.max(0, Math.floor(Number(inventory[drug.itemId] || 0)));
  if (stock < requestedAmount) {
    return failure("street_dealers_insufficient_drug_stock", `Ve SKLADU máš jen ${stock}x ${drug.label}.`);
  }

  const normalized = normalizeLocalStreetDealerSales(saleState);
  if (normalized.slots.some((slot) => slot.completesAt > now)) {
    return failure("street_dealers_sale_active", "Jiný prodej Pouličních dealerů už probíhá.");
  }
  const currentSlot = normalized.slots.find((slot) => slot.slotId === slotId);
  if (currentSlot && currentSlot.completesAt > now) {
    return failure("street_dealers_slot_locked", "Tato látka už zpracovává jiný prodej.");
  }

  const extraDealers = Math.max(0, Math.floor(Number(ownedCount || 0)) - 1);
  const network = config.network;
  const speedMultiplier = Math.min(network.maxSaleSpeedMultiplier, 1 + extraDealers * network.saleSpeedBonusPctPerExtraDealer / 100);
  const heatMultiplier = Math.min(network.maxHeatMultiplier, 1 + extraDealers * network.heatBonusPctPerExtraDealer / 100);
  const supplySpeedBonusPct = Math.max(0, Number(tunnelSupport.saleSpeedBonusPct || 0));
  const supplyHeatBonusPct = Math.max(0, Number(tunnelSupport.saleHeatRiskBonusPct || 0));
  const openSpeedBonusPct = Math.max(0, Number(openChannel.dealerSaleSpeedBonusPct || 0));
  const phaseModifiers = resolveDayNightModifiers(phase, dayNightRule);
  const durationMs = Math.max(
    1_000,
    Math.ceil(drug.cooldownMinutes * 60_000 /
      (speedMultiplier * (1 + supplySpeedBonusPct / 100 + openSpeedBonusPct / 100)))
  );
  const rewardDirtyCash = Math.floor(requestedAmount * drug.unitSalePriceDirtyCash);
  const heatGain = Math.ceil(
    requestedAmount
      * drug.baseHeatPerUnit
      * heatMultiplier
      * (1 + supplyHeatBonusPct / 100)
      * (1 + Math.max(0, Number(openChannel.dealerSaleHeatBonusPct || 0)) / 100)
      * phaseModifiers.heatMultiplier
  );
  const riskReductionPct = Math.max(0, Number(tunnelSupport.streetRiskReductionPct || 0));
  const streetRiskPct = clamp(
    drug.baseStreetRiskPct
      + Math.max(0, requestedAmount - 1) * 0.5
      - riskReductionPct
      + Math.max(0, Number(openChannel.streetIncidentFlatRiskPct || 0))
      + phaseModifiers.detectionChanceModifierPct,
    0,
    config.streetIncidents.maxStreetRiskPct
  );
  const sale = {
    saleId: `local-street-sale:${slotId}:${now}`,
    slotId,
    itemId: drug.itemId,
    itemLabel: drug.label,
    amount: requestedAmount,
    startedAt: now,
    completesAt: now + durationMs,
    rewardDirtyCash,
    heatGain,
    streetRiskPct
  };
  return {
    ok: true,
    sale,
    nextInventory: {
      ...inventory,
      [drug.itemId]: stock - requestedAmount
    },
    nextSaleState: {
      slots: [
        ...normalized.slots.filter((candidate) => candidate.slotId !== slotId),
        sale
      ]
    }
  };
}

export function settleLocalStreetDealerSales(saleState = {}, now = Date.now()) {
  const normalized = normalizeLocalStreetDealerSales(saleState);
  const completed = normalized.slots.filter((slot) => slot.completesAt <= now);
  return {
    completed,
    nextSaleState: {
      slots: normalized.slots.filter((slot) => slot.completesAt > now)
    }
  };
}

const failure = (code, message) => ({ ok: false, code, message });

const resolveDayNightModifiers = (phase, rule = {}) => {
  const normalizedPhase = phase === "day" ? "day" : "night";
  const preferredPhase = rule.preferredPhase === "day" ? "day" : rule.preferredPhase === "night" ? "night" : null;
  const appliesPenalty = Boolean(preferredPhase && normalizedPhase !== preferredPhase);
  return {
    phase: normalizedPhase,
    rewardMultiplier: appliesPenalty ? toNonNegativeMultiplier(rule.rewardMultiplier, 1) : 1,
    heatMultiplier: appliesPenalty ? toNonNegativeMultiplier(rule.heatMultiplier, 1) : 1,
    detectionChanceModifierPct: appliesPenalty ? Math.max(0, Number(rule.detectionChanceModifierPct || 0)) : 0
  };
};

const toNonNegativeMultiplier = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const formatPhaseStatus = (modifiers) => {
  const phaseLabel = modifiers.phase === "day" ? "DEN" : "NOC";
  const details = [];
  const rewardPct = Math.round((modifiers.rewardMultiplier - 1) * 100);
  const heatPct = Math.round((modifiers.heatMultiplier - 1) * 100);
  if (rewardPct !== 0) details.push(`výnos ${rewardPct > 0 ? "+" : ""}${rewardPct} %`);
  if (heatPct !== 0) details.push(`heat ${heatPct > 0 ? "+" : ""}${heatPct} %`);
  if (modifiers.detectionChanceModifierPct > 0) details.push(`riziko +${modifiers.detectionChanceModifierPct} p. b.`);
  return details.length > 0 ? `${phaseLabel}: ${details.join(", ")}` : `${phaseLabel}: standardní výnos`;
};

const formatRemaining = (remainingMs) => {
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
};
