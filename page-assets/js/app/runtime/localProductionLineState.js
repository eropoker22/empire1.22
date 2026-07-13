function toNonNegativeInteger(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isFinite(normalized) ? Math.max(0, normalized) : Math.max(0, fallback);
}

function toPositiveInteger(value, fallback = 1) {
  return Math.max(1, toNonNegativeInteger(value, fallback));
}

function normalizeInputs(inputs = {}) {
  return Object.fromEntries(Object.entries(inputs || {}).map(([resourceKey, amount]) => [
    resourceKey,
    toNonNegativeInteger(amount)
  ]));
}

function createReservationUnit(cleanMoney = 0, inputs = {}) {
  return {
    cleanMoney: toNonNegativeInteger(cleanMoney),
    inputs: normalizeInputs(inputs)
  };
}

function buildLegacyReservationUnits(job, queuedAmount) {
  if (queuedAmount <= 0) return [];
  const cleanTotal = toNonNegativeInteger(job?.cleanMoneyCost);
  const inputTotals = normalizeInputs(job?.inputs);
  return Array.from({ length: queuedAmount }, (_, index) => createReservationUnit(
    Math.floor(cleanTotal / queuedAmount) + (index < cleanTotal % queuedAmount ? 1 : 0),
    Object.fromEntries(Object.entries(inputTotals).map(([resourceKey, amount]) => [
      resourceKey,
      Math.floor(amount / queuedAmount) + (index < amount % queuedAmount ? 1 : 0)
    ]))
  ));
}

function sumReservationUnits(units = []) {
  const inputs = {};
  let cleanMoney = 0;
  for (const unit of units) {
    cleanMoney += toNonNegativeInteger(unit?.cleanMoney);
    for (const [resourceKey, amount] of Object.entries(unit?.inputs || {})) {
      inputs[resourceKey] = toNonNegativeInteger(inputs[resourceKey]) + toNonNegativeInteger(amount);
    }
  }
  return { cleanMoney, inputs };
}

function resolveStatus(job) {
  if (job.queuedAmount > 0 && job.isProducing) return "running";
  if (job.queuedAmount > 0) return "waiting";
  if (job.producedAmount > 0) return "ready";
  return "idle";
}

export function normalizeLocalProductionJob(rawJob = null, defaults = {}) {
  if (!rawJob) return null;
  const durationMs = toPositiveInteger(rawJob.unitDurationMs ?? defaults.unitDurationMs ?? rawJob.durationMs, 1000);
  const localOutputCap = toPositiveInteger(rawJob.localOutputCap ?? defaults.localOutputCap, 1);
  const queueCapacity = toPositiveInteger(rawJob.queueCapacity ?? defaults.queueCapacity, 1);
  const isModern = Number(rawJob.version || 0) >= 2
    || Object.prototype.hasOwnProperty.call(rawJob, "queuedAmount")
    || Object.prototype.hasOwnProperty.call(rawJob, "producedAmount");
  const legacyQuantity = toNonNegativeInteger(rawJob.quantity ?? rawJob.output?.amount, rawJob.status === "ready" ? 0 : 1);
  const queuedAmount = isModern
    ? toNonNegativeInteger(rawJob.queuedAmount)
    : rawJob.status === "ready" ? 0 : legacyQuantity;
  const producedAmount = isModern
    ? toNonNegativeInteger(rawJob.producedAmount)
    : rawJob.status === "ready" ? toNonNegativeInteger(rawJob.output?.amount, 1) : 0;
  const sourceReservations = Array.isArray(rawJob.reservationUnits)
    ? rawJob.reservationUnits.slice(0, queuedAmount).map((unit) => createReservationUnit(unit?.cleanMoney, unit?.inputs))
    : buildLegacyReservationUnits(rawJob, queuedAmount);
  while (sourceReservations.length < queuedAmount) {
    sourceReservations.push(createReservationUnit(defaults.unitCleanMoneyCost, defaults.unitInputs));
  }
  const reservationTotals = sumReservationUnits(sourceReservations);
  const readyAtMs = Number.isFinite(Number(rawJob.readyAtMs))
    ? Number(rawJob.readyAtMs)
    : new Date(rawJob.readyAt || 0).getTime();
  const capHasSpace = producedAmount < localOutputCap;
  const isProducing = queuedAmount > 0
    && capHasSpace
    && rawJob.status !== "waiting"
    && rawJob.isProducing !== false;
  const normalized = {
    ...rawJob,
    version: 2,
    queuedAmount,
    producedAmount,
    quantity: queuedAmount,
    unitDurationMs: durationMs,
    durationMs,
    localOutputCap,
    queueCapacity,
    reservationUnits: sourceReservations,
    inputs: reservationTotals.inputs,
    cleanMoneyCost: reservationTotals.cleanMoney,
    isProducing,
    readyAtMs: isProducing && Number.isFinite(readyAtMs) && readyAtMs > 0 ? readyAtMs : null,
    output: {
      ...(defaults.output || {}),
      ...(rawJob.output || {}),
      amount: producedAmount
    }
  };
  normalized.status = resolveStatus(normalized);
  normalized.readyAt = normalized.readyAtMs ? new Date(normalized.readyAtMs).toISOString() : null;
  return normalized;
}

export function queueLocalProduction(job, order = {}) {
  const quantity = toPositiveInteger(order.quantity, 1);
  const now = Number.isFinite(Number(order.now)) ? Number(order.now) : Date.now();
  const current = normalizeLocalProductionJob(job, order) || normalizeLocalProductionJob({
    version: 2,
    queuedAmount: 0,
    producedAmount: 0,
    output: order.output
  }, order);
  if (current.producedAmount >= current.localOutputCap) {
    return { ok: false, reason: "output_full", job: current };
  }
  if (quantity > Math.max(0, current.queueCapacity - current.queuedAmount)) {
    return { ok: false, reason: "queue_full", job: current };
  }
  const reservation = createReservationUnit(order.unitCleanMoneyCost, order.unitInputs);
  const reservationUnits = [
    ...current.reservationUnits,
    ...Array.from({ length: quantity }, () => createReservationUnit(reservation.cleanMoney, reservation.inputs))
  ];
  const totals = sumReservationUnits(reservationUnits);
  const startsNow = !current.isProducing && current.queuedAmount === 0;
  const next = {
    ...current,
    queuedAmount: current.queuedAmount + quantity,
    quantity: current.queuedAmount + quantity,
    reservationUnits,
    inputs: totals.inputs,
    cleanMoneyCost: totals.cleanMoney,
    isProducing: current.isProducing || startsNow,
    readyAtMs: current.isProducing ? current.readyAtMs : now + current.unitDurationMs
  };
  next.status = resolveStatus(next);
  next.readyAt = next.readyAtMs ? new Date(next.readyAtMs).toISOString() : null;
  return { ok: true, job: next };
}

export function advanceLocalProductionJob(job, now = Date.now()) {
  const current = normalizeLocalProductionJob(job);
  if (!current || !current.isProducing || !current.readyAtMs || current.readyAtMs > now) {
    return { changed: false, completedAmount: 0, job: current };
  }
  const availableOutputSpace = Math.max(0, current.localOutputCap - current.producedAmount);
  const elapsedCycles = 1 + Math.floor(Math.max(0, now - current.readyAtMs) / current.unitDurationMs);
  const completedAmount = Math.min(elapsedCycles, current.queuedAmount, availableOutputSpace);
  if (completedAmount <= 0) {
    const waiting = { ...current, isProducing: false, readyAtMs: null, readyAt: null };
    waiting.status = resolveStatus(waiting);
    return { changed: waiting.status !== current.status || current.isProducing, completedAmount: 0, job: waiting };
  }
  const reservationUnits = current.reservationUnits.slice(completedAmount);
  const totals = sumReservationUnits(reservationUnits);
  const queuedAmount = current.queuedAmount - completedAmount;
  const producedAmount = current.producedAmount + completedAmount;
  const canContinue = queuedAmount > 0 && producedAmount < current.localOutputCap;
  const nextReadyAtMs = canContinue ? current.readyAtMs + completedAmount * current.unitDurationMs : null;
  const next = {
    ...current,
    queuedAmount,
    producedAmount,
    quantity: queuedAmount,
    reservationUnits,
    inputs: totals.inputs,
    cleanMoneyCost: totals.cleanMoney,
    isProducing: canContinue,
    readyAtMs: nextReadyAtMs,
    readyAt: nextReadyAtMs ? new Date(nextReadyAtMs).toISOString() : null,
    output: { ...current.output, amount: producedAmount }
  };
  next.status = resolveStatus(next);
  return { changed: true, completedAmount, job: next };
}

export function cancelWaitingLocalProduction(job) {
  const current = normalizeLocalProductionJob(job);
  if (!current) return { ok: false, reason: "empty", job: current, refund: createReservationUnit() };
  const activeAmount = current.isProducing && current.queuedAmount > 0 ? 1 : 0;
  const waitingAmount = Math.max(0, current.queuedAmount - activeAmount);
  if (waitingAmount <= 0) {
    return { ok: false, reason: "no_waiting", job: current, refund: createReservationUnit() };
  }
  const keptReservations = current.reservationUnits.slice(0, activeAmount);
  const refundedReservations = current.reservationUnits.slice(activeAmount);
  const keptTotals = sumReservationUnits(keptReservations);
  const refund = sumReservationUnits(refundedReservations);
  const next = {
    ...current,
    queuedAmount: activeAmount,
    quantity: activeAmount,
    reservationUnits: keptReservations,
    inputs: keptTotals.inputs,
    cleanMoneyCost: keptTotals.cleanMoney,
    isProducing: activeAmount > 0,
    readyAtMs: activeAmount > 0 ? current.readyAtMs : null,
    readyAt: activeAmount > 0 && current.readyAtMs ? new Date(current.readyAtMs).toISOString() : null
  };
  next.status = resolveStatus(next);
  return { ok: true, waitingAmount, refund, job: next };
}

export function collectLocalProduction(job, receivableAmount, now = Date.now()) {
  const current = normalizeLocalProductionJob(job);
  if (!current) return { collectedAmount: 0, remainingAmount: 0, job: current };
  const collectedAmount = Math.min(current.producedAmount, toNonNegativeInteger(receivableAmount));
  const producedAmount = current.producedAmount - collectedAmount;
  const shouldResume = current.queuedAmount > 0 && producedAmount < current.localOutputCap && !current.isProducing;
  const next = {
    ...current,
    producedAmount,
    isProducing: current.isProducing || shouldResume,
    readyAtMs: shouldResume ? now + current.unitDurationMs : current.readyAtMs,
    output: { ...current.output, amount: producedAmount }
  };
  next.readyAt = next.readyAtMs ? new Date(next.readyAtMs).toISOString() : null;
  next.status = resolveStatus(next);
  return { collectedAmount, remainingAmount: producedAmount, job: next };
}
